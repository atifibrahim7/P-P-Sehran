const prisma = require('../config/prisma');

function deriveOrderState(o) {
	if (o.paymentStatus === 'PAID') {
		return o.status === 'COMPLETED' ? 'completed' : 'paid';
	}
	if (o.status === 'PROCESSING') return 'processing';
	return 'pending';
}

function serializeOrder(order) {
	const items = order.items || [];
	let totalPatient = 0;
	let totalPractitioner = 0;
	for (const it of items) {
		const q = it.quantity ?? 1;
		totalPatient += Number(it.patientPrice) * q;
		totalPractitioner += Number(it.practitionerPrice) * q;
	}
	const practitionerUserId = order.practitioner ? order.practitioner.userId : null;
	const patientUserId = order.patient ? order.patient.userId : null;
	const createdAt =
		order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt;
	const out = {
		id: order.id,
		type: order.type === 'SELF' ? 'practitioner_self' : 'patient',
		practitionerId: practitionerUserId,
		patientId: patientUserId,
		state: deriveOrderState(order),
		createdAt,
		total_patient: totalPatient,
		total_practitioner: totalPractitioner,
		totalAmount: Number(order.totalAmount),
		status: order.status,
		paymentStatus: order.paymentStatus,
		inuviOrderId: order.inuviOrderId ?? null,
		inuviSyncError: order.inuviSyncError ?? null,
		inuviSyncedAt:
			order.inuviSyncedAt instanceof Date ? order.inuviSyncedAt.toISOString() : order.inuviSyncedAt ?? null,
	};
	const pru = order.practitioner?.user;
	if (pru) {
		out.practitionerName = pru.name;
		out.practitionerEmail = pru.email;
	}
	const pu = order.patient?.user;
	if (pu) {
		out.patientName = pu.name;
		out.patientEmail = pu.email;
	}
	return out;
}

function serializeOrderItem(it) {
	const base = {
		id: it.id,
		orderId: it.orderId,
		productId: it.productId,
		quantity: it.quantity ?? 1,
		unit_patient_price: Number(it.patientPrice),
		unit_practitioner_price: Number(it.practitionerPrice),
	};
	if (it.product) {
		base.product = {
			id: it.product.id,
			name: it.product.name,
			category: it.product.category,
		};
	}
	return base;
}

function productCategoryLabel(cat) {
	if (cat === 'BLOOD_TEST') return 'Lab test';
	if (cat === 'SUPPLEMENT') return 'Supplement';
	return String(cat ?? '');
}

/** Commission row for admin + practitioner lists (requires order + practitioner includes). */
function serializeCommissionListItem(r) {
	const o = r.order;
	const patientUser = o?.patient?.user;
	const items = o?.items || [];
	const productsSummary = items.length
		? items
				.map((it) => {
					const name = it.product?.name || 'Product';
					const kind = productCategoryLabel(it.product?.category);
					return `${name} (${kind})`;
				})
				.join('; ')
		: '—';
	const createdAt =
		o?.createdAt instanceof Date ? o.createdAt.toISOString() : o?.createdAt ?? null;
	return {
		id: r.id,
		orderId: r.orderId,
		amount: Number(r.amount),
		payoutStatus: r.payoutStatus,
		practitionerId: r.practitioner.userId,
		practitionerProfileId: r.practitionerId,
		practitionerName: r.practitioner.user.name,
		practitionerEmail: r.practitioner.user.email,
		patientName: patientUser?.name ?? null,
		patientEmail: patientUser?.email ?? null,
		productsSummary,
		orderCreatedAt: createdAt,
	};
}

function serializeTestResult(r) {
	return {
		id: r.id,
		orderId: r.orderId,
		resultUrl: r.reportUrl,
		reportUrl: r.reportUrl,
		summary: r.summary ?? null,
		status: r.status,
	};
}

const orderInclude = {
	items: { include: { product: true } },
	patient: { include: { user: { select: { id: true, name: true, email: true } } } },
	practitioner: { include: { user: { select: { id: true, name: true, email: true } } } },
};

/** List endpoint: user rows for labels + search */
const orderListInclude = {
	items: true,
	patient: { include: { user: { select: { name: true, email: true } } } },
	practitioner: { include: { user: { select: { name: true, email: true } } } },
};

async function loadOrderWithRelations(orderId) {
	return prisma.order.findUnique({
		where: { id: Number(orderId) },
		include: orderInclude,
	});
}

module.exports = {
	deriveOrderState,
	serializeOrder,
	serializeOrderItem,
	serializeCommissionListItem,
	serializeTestResult,
	productCategoryLabel,
	orderInclude,
	orderListInclude,
	loadOrderWithRelations,
};
