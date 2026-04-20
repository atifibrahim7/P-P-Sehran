const prisma = require('../../config/prisma');
const { parsePagination, paginateResult } = require('../../utils/pagination');
const {
	serializeOrder,
	serializeOrderItem,
	orderInclude,
	orderListInclude,
	loadOrderWithRelations,
} = require('../../lib/serialize');

const ORDER_STATES = ['pending', 'paid', 'processing', 'completed'];

/** Upsert without Prisma upsert — MariaDB adapter can throw P2002 on duplicate orderId. */
async function setCommissionForOrder(orderId, practitionerId, amount) {
	const existing = await prisma.commission.findUnique({ where: { orderId } });
	if (existing) {
		await prisma.commission.update({ where: { orderId }, data: { amount } });
		return;
	}
	try {
		await prisma.commission.create({
			data: { practitionerId, orderId, amount },
		});
	} catch (err) {
		if (err && err.code === 'P2002') {
			await prisma.commission.update({ where: { orderId }, data: { amount } });
			return;
		}
		throw err;
	}
}

async function createOrder({ createdByUserId, practitionerId: practitionerUserId, patientId: patientUserId, type, items }) {
	if (!['practitioner_self', 'patient'].includes(type)) {
		throw Object.assign(new Error('Invalid order type'), { status: 400 });
	}
	if (!Array.isArray(items) || items.length === 0) {
		throw Object.assign(new Error('At least one item required'), { status: 400 });
	}

	let patientProfileId = null;
	let practitionerDbId = null;

	if (type === 'practitioner_self') {
		const practitioner = await prisma.practitioner.findUnique({
			where: { userId: Number(practitionerUserId) },
		});
		if (!practitioner) throw Object.assign(new Error('Invalid practitionerId'), { status: 400 });
		practitionerDbId = practitioner.id;
	} else {
		const patient = await prisma.patient.findUnique({
			where: { userId: Number(patientUserId) },
		});
		if (!patient) throw Object.assign(new Error('Invalid patientId'), { status: 400 });
		patientProfileId = patient.id;

		const pu =
			practitionerUserId != null && practitionerUserId !== undefined && String(practitionerUserId) !== '';
		if (pu) {
			const pr = await prisma.practitioner.findUnique({
				where: { userId: Number(practitionerUserId) },
			});
			if (!pr) throw Object.assign(new Error('Invalid practitionerId'), { status: 400 });
			if (patient.practitionerId != null && patient.practitionerId !== pr.id) {
				throw Object.assign(new Error('Patient is not linked to this practitioner'), { status: 403 });
			}
			practitionerDbId = pr.id;
		} else if (patient.practitionerId != null) {
			const pr = await prisma.practitioner.findUnique({
				where: { id: patient.practitionerId },
			});
			if (pr) practitionerDbId = pr.id;
		}
	}

	const orderType = type === 'practitioner_self' ? 'SELF' : 'PATIENT';
	const lineCreates = [];
	let totalPatient = 0;
	let totalPractitioner = 0;

	for (const it of items) {
		const product = await prisma.product.findUnique({ where: { id: Number(it.productId) } });
		if (!product) throw Object.assign(new Error('Invalid product in items'), { status: 400 });
		const quantity = it.quantity && it.quantity > 0 ? Number(it.quantity) : 1;
		const pp = Number(product.patientPrice);
		const pr = Number(product.practitionerPrice);
		totalPatient += pp * quantity;
		totalPractitioner += pr * quantity;
		lineCreates.push({
			productId: product.id,
			quantity,
			patientPrice: pp,
			practitionerPrice: pr,
		});
	}

	const totalAmount = orderType === 'PATIENT' ? totalPatient : totalPractitioner;

	const order = await prisma.order.create({
		data: {
			type: orderType,
			patientId: patientProfileId,
			practitionerId: practitionerDbId,
			totalAmount,
			status: 'PENDING',
			paymentStatus: 'PENDING',
			items: { create: lineCreates },
		},
		include: orderInclude,
	});

	return {
		order: serializeOrder(order),
		items: order.items.map(serializeOrderItem),
	};
}

async function markPaid(orderId) {
	const id = Number(orderId);
	if (Number.isNaN(id)) throw Object.assign(new Error('Order not found'), { status: 404 });

	const order = await prisma.order.findUnique({
		where: { id },
		include: { items: true },
	});
	if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

	await prisma.order.update({
		where: { id },
		data: { paymentStatus: 'PAID' },
	});

	if (order.type === 'PATIENT' && order.practitionerId) {
		let totalPatient = 0;
		let totalPractitioner = 0;
		for (const it of order.items) {
			const q = it.quantity ?? 1;
			totalPatient += Number(it.patientPrice) * q;
			totalPractitioner += Number(it.practitionerPrice) * q;
		}
		const amount = Math.max(0, totalPatient - totalPractitioner);
		if (amount > 0) {
			await setCommissionForOrder(id, order.practitionerId, amount);
		}
	}

	const full = await loadOrderWithRelations(id);
	return serializeOrder(full);
}

function normalizeOrderTypeFilter(typeParam) {
	if (typeParam == null || typeParam === '') return null;
	const raw = String(typeParam).trim();
	const upper = raw.toUpperCase();
	if (upper === 'PATIENT' || upper === 'SELF') return upper;
	const t = raw.toLowerCase();
	if (t === 'patient' || t === 'patients') return 'PATIENT';
	if (t === 'practitioner_self' || t === 'self') return 'SELF';
	return null;
}

function stateToPrismaWhere(stateParam) {
	if (stateParam == null || stateParam === '') return null;
	const s = String(stateParam).toLowerCase();
	if (s === 'completed') return { paymentStatus: 'PAID', status: 'COMPLETED' };
	if (s === 'paid') return { paymentStatus: 'PAID', status: { not: 'COMPLETED' } };
	if (s === 'processing') return { paymentStatus: { not: 'PAID' }, status: 'PROCESSING' };
	if (s === 'pending') return { paymentStatus: { not: 'PAID' }, status: { not: 'PROCESSING' } };
	return null;
}

async function listOrdersPageForUser(user, query = {}) {
	const { page, pageSize } = parsePagination(query);
	const typeFilter = normalizeOrderTypeFilter(query.type);
	const stateWhere = stateToPrismaWhere(query.state);
	const qRaw = query.q != null && query.q !== '' ? String(query.q).trim() : '';

	const uid = Number(user.userId);
	const clauses = [];

	if (user.role === 'admin') {
		// no scope clause
	} else if (user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: uid } });
		if (!pr) {
			return paginateResult([], page, pageSize, 0);
		}
		clauses.push({ practitionerId: pr.id });
	} else if (user.role === 'patient') {
		const pt = await prisma.patient.findUnique({ where: { userId: uid } });
		if (!pt) {
			return paginateResult([], page, pageSize, 0);
		}
		clauses.push({ patientId: pt.id });
	} else {
		return paginateResult([], page, pageSize, 0);
	}

	if (typeFilter) {
		clauses.push({ type: typeFilter });
	}
	if (stateWhere) {
		clauses.push(stateWhere);
	}
	if (qRaw) {
		if (/^\d+$/.test(qRaw)) {
			clauses.push({ id: Number(qRaw) });
		} else {
			clauses.push({
				OR: [
					{ patient: { user: { name: { contains: qRaw } } } },
					{ patient: { user: { email: { contains: qRaw } } } },
					{ practitioner: { user: { name: { contains: qRaw } } } },
					{ practitioner: { user: { email: { contains: qRaw } } } },
				],
			});
		}
	}

	const where = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { AND: clauses };

	const total = await prisma.order.count({ where });
	const skip = (page - 1) * pageSize;
	const rows = await prisma.order.findMany({
		where,
		include: orderListInclude,
		orderBy: { createdAt: 'desc' },
		skip,
		take: pageSize,
	});
	const items = rows.map(serializeOrder);
	return paginateResult(items, page, pageSize, total);
}

module.exports = { ORDER_STATES, createOrder, markPaid, listOrdersPageForUser };
