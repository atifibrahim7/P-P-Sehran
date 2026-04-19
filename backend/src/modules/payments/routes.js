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

router.post('/checkout', authenticateToken, async (req, res) => {
	const { orderId, successUrl, cancelUrl } = req.body || {};
	if (!orderId || !successUrl || !cancelUrl) return badRequest(res, 'orderId, successUrl, cancelUrl required');

	const id = Number(orderId);
	if (Number.isNaN(id)) return badRequest(res, 'Invalid orderId');

	const order = await prisma.order.findUnique({
		where: { id },
		include: { items: { include: { product: true } } },
	});
	if (!order) return badRequest(res, 'Invalid orderId');

	const lineItems = order.items.map((it) => {
		const name = it.product?.name || 'Product';
		const unit =
			order.type === 'PATIENT'
				? Number(it.patientPrice)
				: Number(it.practitionerPrice);
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

	if (!stripe) {
		return ok(res, {
			mode: 'mock',
			checkoutUrl: `${requiredEnv('FRONTEND_URL', 'http://localhost:5173')}/mock-checkout?orderId=${order.id}`,
		});
	}

	const session = await stripe.checkout.sessions.create({
		payment_method_types: ['card'],
		line_items: lineItems,
		mode: 'payment',
		success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: cancelUrl,
		metadata: { orderId: String(order.id) },
	});
	return ok(res, { id: session.id, url: session.url });
});

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
			const orderId = body && typeof body === 'object' ? body.orderId : undefined;
			if (!orderId) return badRequest(res, 'orderId required in mock mode');
			const order = await markPaid(orderId);
			return ok(res, {
				received: true,
				mode: 'mock',
				confirmed: true,
				paymentStatus: order.paymentStatus,
				order,
			});
		}
		const sig = req.headers['stripe-signature'];
		const endpointSecret = requiredEnv('STRIPE_WEBHOOK_SECRET');
		const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
		if (event.type === 'checkout.session.completed') {
			const session = event.data.object;
			const orderId = session.metadata && session.metadata.orderId;
			if (orderId) await markPaid(orderId);
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
