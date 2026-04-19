const prisma = require('../../config/prisma');
const { serializeOrder, serializeOrderItem, orderInclude, loadOrderWithRelations } = require('../../lib/serialize');

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

	const practitioner = await prisma.practitioner.findUnique({
		where: { userId: Number(practitionerUserId) },
	});
	if (!practitioner) throw Object.assign(new Error('Invalid practitionerId'), { status: 400 });

	let patientProfileId = null;
	if (type === 'patient') {
		const patient = await prisma.patient.findUnique({
			where: { userId: Number(patientUserId) },
		});
		if (!patient) throw Object.assign(new Error('Invalid patientId'), { status: 400 });
		patientProfileId = patient.id;
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
			practitionerId: practitioner.id,
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

async function listOrdersForUser(user) {
	const uid = Number(user.userId);
	if (user.role === 'admin') {
		const rows = await prisma.order.findMany({
			include: orderInclude,
			orderBy: { createdAt: 'desc' },
		});
		return rows.map(serializeOrder);
	}
	if (user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: uid } });
		if (!pr) return [];
		const rows = await prisma.order.findMany({
			where: { practitionerId: pr.id },
			include: orderInclude,
			orderBy: { createdAt: 'desc' },
		});
		return rows.map(serializeOrder);
	}
	if (user.role === 'patient') {
		const pt = await prisma.patient.findUnique({ where: { userId: uid } });
		if (!pt) return [];
		const rows = await prisma.order.findMany({
			where: { patientId: pt.id },
			include: orderInclude,
			orderBy: { createdAt: 'desc' },
		});
		return rows.map(serializeOrder);
	}
	return [];
}

module.exports = { ORDER_STATES, createOrder, markPaid, listOrdersForUser };
