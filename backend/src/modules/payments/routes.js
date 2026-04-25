const { Router } = require('express');
const { ok, badRequest } = require('../../utils/response');
const { authenticateToken } = require('../../middleware/auth');
const { requiredEnv } = require('../../config/env');
const prisma = require('../../config/prisma');
const { markPaid } = require('../orders/service');

let stripe = null;
try {
	const key = process.env.STRIPE_SECRET_KEY;
	if (key) {
		// eslint-disable-next-line global-require
		stripe = require('stripe')(key);
	}
} catch (_e) {
	stripe = null;
}

const router = Router();

function normalizeOrderIds(body) {
	const raw = body || {};
	let ids = [];
	if (Array.isArray(raw.orderIds) && raw.orderIds.length) {
		ids = raw.orderIds.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
	} else if (raw.orderId != null && raw.orderId !== '') {
		const one = Number(raw.orderId);
		if (!Number.isNaN(one)) ids = [one];
	}
	const unique = [...new Set(ids)];
	unique.sort((a, b) => a - b);
	return unique;
}

/**
 * Build Stripe line items and validate orders belong to the authenticated patient, all unpaid PATIENT orders.
 */
async function loadOrdersForPatientCheckout(orderIds, patientUserId) {
	if (!orderIds.length) {
		throw Object.assign(new Error('orderId or orderIds required'), { status: 400 });
	}

	const patient = await prisma.patient.findUnique({
		where: { userId: Number(patientUserId) },
	});
	if (!patient) throw Object.assign(new Error('Patient profile not found'), { status: 403 });

	const orders = await prisma.order.findMany({
		where: { id: { in: orderIds } },
		include: { items: { include: { product: true } } },
		orderBy: { id: 'asc' },
	});
	if (orders.length !== orderIds.length) {
		throw Object.assign(new Error('One or more orders not found'), { status: 400 });
	}

	const lineItems = [];
	for (const order of orders) {
		if (order.patientId !== patient.id) {
			throw Object.assign(new Error('Order does not belong to you'), { status: 403 });
		}
		if (order.type !== 'PATIENT') {
			throw Object.assign(new Error('Only patient orders can be paid here'), { status: 400 });
		}
		if (order.paymentStatus !== 'PENDING') {
			throw Object.assign(new Error(`Order #${order.id} is already paid or not payable`), { status: 400 });
		}
		for (const it of order.items) {
			const nameBase = it.product?.name || 'Product';
			const name = orders.length > 1 ? `Order #${order.id} — ${nameBase}` : nameBase;
			const unit = Number(it.patientPrice);
			const unitAmount = Math.round(unit * 100);
			lineItems.push({
				price_data: {
					currency: 'usd',
					product_data: { name },
					unit_amount: unitAmount,
				},
				quantity: it.quantity ?? 1,
			});
		}
	}

	return { orders, lineItems, patient, orderIds };
}

/** Single SELF order checkout for the owning practitioner (practitioner-priced lines). */
async function loadSelfOrderForPractitionerCheckout(orderId, practitionerUserId) {
	const pr = await prisma.practitioner.findUnique({
		where: { userId: Number(practitionerUserId) },
	});
	if (!pr) throw Object.assign(new Error('Practitioner profile not found'), { status: 403 });

	const order = await prisma.order.findUnique({
		where: { id: Number(orderId) },
		include: { items: { include: { product: true } } },
	});
	if (!order) throw Object.assign(new Error('Order not found'), { status: 400 });
	if (order.type !== 'SELF') {
		throw Object.assign(new Error('This checkout is for practitioner self-orders only'), { status: 400 });
	}
	if (order.practitionerId !== pr.id) {
		throw Object.assign(new Error('Order does not belong to you'), { status: 403 });
	}
	if (order.paymentStatus !== 'PENDING') {
		throw Object.assign(new Error('Order is already paid or not payable'), { status: 400 });
	}

	const lineItems = order.items.map((it) => {
		const name = it.product?.name || 'Product';
		const unit = Number(it.practitionerPrice);
		const unitAmount = Math.round(unit * 100);
		return {
			price_data: {
				currency: 'usd',
				product_data: { name },
				unit_amount: unitAmount,
			},
			quantity: it.quantity ?? 1,
		};
	});

	return { lineItems, orderIds: [order.id] };
}

router.post('/checkout', authenticateToken, async (req, res) => {
	const { successUrl, cancelUrl } = req.body || {};
	if (!successUrl || !cancelUrl) return badRequest(res, 'successUrl, cancelUrl required');

	const orderIds = normalizeOrderIds(req.body);
	if (!orderIds.length) return badRequest(res, 'orderId or non-empty orderIds required');

	try {
		let lineItems;
		let idsNorm;
		if (req.user.role === 'patient') {
			const loaded = await loadOrdersForPatientCheckout(orderIds, req.user.userId);
			lineItems = loaded.lineItems;
			idsNorm = orderIds;
		} else if (req.user.role === 'practitioner') {
			if (orderIds.length !== 1) {
				throw Object.assign(new Error('Check out one order at a time for practitioner orders'), {
					status: 400,
				});
			}
			const loaded = await loadSelfOrderForPractitionerCheckout(orderIds[0], req.user.userId);
			lineItems = loaded.lineItems;
			idsNorm = loaded.orderIds;
		} else {
			return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
		}

		const metaKey = idsNorm.length === 1 ? 'orderId' : 'orderIds';

		if (!stripe) {
			const qs =
				idsNorm.length === 1
					? `orderId=${idsNorm[0]}`
					: `orderIds=${encodeURIComponent(idsNorm.join(','))}`;
			return ok(res, {
				mode: 'mock',
				checkoutUrl: `${requiredEnv('FRONTEND_URL', 'http://localhost:5173')}/mock-checkout?${qs}`,
			});
		}

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: lineItems,
			mode: 'payment',
			success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: cancelUrl,
			metadata:
				metaKey === 'orderId'
					? { orderId: String(idsNorm[0]) }
					: { orderIds: idsNorm.join(',') },
		});
		return ok(res, { id: session.id, url: session.url });
	} catch (e) {
		if (e.status) return res.status(e.status).json({ success: false, error: { message: e.message } });
		throw e;
	}
});

async function markPaidFromMetadata(meta) {
	if (!meta) return;
	const comma = meta.orderIds;
	if (comma && String(comma).trim()) {
		const ids = String(comma)
			.split(',')
			.map((s) => Number(s.trim()))
			.filter((n) => !Number.isNaN(n));
		for (const id of ids) {
			await markPaid(id);
		}
		return;
	}
	const one = meta.orderId;
	if (one != null && String(one).trim() !== '') {
		await markPaid(one);
	}
}

router.post('/webhook', expressRawJson(), async (req, res) => {
	try {
		if (!stripe) {
			let body = req.body;
			if (Buffer.isBuffer(body)) body = body.toString('utf8');
			if (typeof body === 'string') {
				try {
					body = JSON.parse(body);
				} catch {
					return badRequest(res, 'Invalid JSON body');
				}
			}
			if (!body || typeof body !== 'object') return badRequest(res, 'Invalid body');
			if (Array.isArray(body.orderIds) && body.orderIds.length) {
				const last = [];
				for (const id of body.orderIds) {
					const o = await markPaid(id);
					last.push(o);
				}
				return ok(res, {
					received: true,
					mode: 'mock',
					confirmed: true,
					orders: last,
				});
			}
			if (body.orderId != null && body.orderId !== '') {
				const order = await markPaid(body.orderId);
				return ok(res, {
					received: true,
					mode: 'mock',
					confirmed: true,
					paymentStatus: order.paymentStatus,
					order,
				});
			}
			return badRequest(res, 'orderId or orderIds required in mock mode');
		}
		const sig = req.headers['stripe-signature'];
		const endpointSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
		const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
		if (event.type === 'checkout.session.completed') {
			const session = event.data.object;
			await markPaidFromMetadata(session.metadata || {});
		}
		return res.json({ received: true });
	} catch (err) {
		return res.status(400).send(`Webhook Error: ${err.message}`);
	}
});

function expressRawJson() {
	return (req, res, next) => {
		if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
			return next();
		}
		let data = '';
		req.setEncoding('utf8');
		req.on('data', (chunk) => {
			data += chunk;
		});
		req.on('end', () => {
			req.body = data;
			next();
		});
	};
}

module.exports = router;
