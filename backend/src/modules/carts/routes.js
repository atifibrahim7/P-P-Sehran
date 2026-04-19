const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { createOrder } = require('../orders/service');

const router = Router();

function productMini(p) {
	if (!p) return null;
	return {
		id: p.id,
		name: p.name,
		description: p.description || '',
		category: p.category === 'BLOOD_TEST' ? 'lab_test' : 'supplement',
		type: p.category === 'BLOOD_TEST' ? 'lab_test' : 'supplement',
		patient_price: Number(p.patientPrice),
		practitioner_price: Number(p.practitionerPrice),
		price: Number(p.patientPrice),
		imageLink: p.imageUrl || null,
	};
}

function serializeCartItem(row) {
	return {
		id: row.id,
		productId: row.productId,
		quantity: row.quantity,
		addedBy: row.addedBy === 'PRACTITIONER' ? 'practitioner' : 'patient',
		product: productMini(row.product),
	};
}

function serializeCart(cart) {
	if (!cart) return null;
	return {
		id: cart.id,
		scope: cart.scope === 'SELF' ? 'self' : 'patient',
		practitionerId: cart.practitionerId,
		patientId: cart.patientId,
		patientUserId: cart.patient?.userId ?? null,
		items: (cart.items || []).map(serializeCartItem),
		updatedAt: cart.updatedAt,
	};
}

async function getOrCreateCart(practitionerId, scope, patientProfileId) {
	const where =
		scope === 'SELF'
			? { practitionerId, scope: 'SELF', patientId: null }
			: { practitionerId, scope: 'PATIENT', patientId: patientProfileId };

	let cart = await prisma.cart.findFirst({ where });
	if (!cart) {
		cart = await prisma.cart.create({
			data: {
				practitionerId,
				scope,
				patientId: scope === 'SELF' ? null : patientProfileId,
			},
		});
	}
	return cart;
}

async function loadCartFull(cartId) {
	return prisma.cart.findUnique({
		where: { id: cartId },
		include: {
			items: { include: { product: true } },
			patient: true,
		},
	});
}

/** GET — practitioner: ?forPatientUserId= — patient: no params */
router.get('/', authenticateToken, async (req, res) => {
	const role = req.user.role;
	if (role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!pr) return badRequest(res, 'Practitioner profile not found');
		const forPatientUserId = req.query.forPatientUserId ? Number(req.query.forPatientUserId) : null;
		let cart;
		if (forPatientUserId) {
			const patient = await prisma.patient.findFirst({
				where: { userId: forPatientUserId, practitionerId: pr.id },
				include: { user: true },
			});
			if (!patient) return badRequest(res, 'Patient not found or not assigned to you');
			const c = await getOrCreateCart(pr.id, 'PATIENT', patient.id);
			cart = await loadCartFull(c.id);
		} else {
			const c = await getOrCreateCart(pr.id, 'SELF', null);
			cart = await loadCartFull(c.id);
		}
		return ok(res, { cart: serializeCart(cart) });
	}
	if (role === 'patient') {
		const patient = await prisma.patient.findUnique({
			where: { userId: Number(req.user.userId) },
			include: { practitioner: true },
		});
		if (!patient || !patient.practitionerId) {
			return ok(res, {
				cart: null,
				message:
					'No practitioner is linked to your account yet. Ask your clinic to assign you so you can share a cart.',
			});
		}
		const c = await getOrCreateCart(patient.practitionerId, 'PATIENT', patient.id);
		const cart = await loadCartFull(c.id);
		return ok(res, { cart: serializeCart(cart) });
	}
	return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
});

/** POST /carts/items */
router.post('/items', authenticateToken, async (req, res) => {
	const { productId, quantity } = req.body || {};
	const qty = Math.max(1, Number(quantity) || 1);
	if (!productId) return badRequest(res, 'productId required');

	const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
	if (!product) return badRequest(res, 'Product not found');

	if (req.user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!pr) return badRequest(res, 'Practitioner profile not found');
		const forPatientUserId = req.body.forPatientUserId != null ? Number(req.body.forPatientUserId) : null;

		let cartRow;
		if (forPatientUserId) {
			const patient = await prisma.patient.findFirst({
				where: { userId: forPatientUserId, practitionerId: pr.id },
			});
			if (!patient) return badRequest(res, 'Patient not found or not assigned to you');
			cartRow = await getOrCreateCart(pr.id, 'PATIENT', patient.id);
			await prisma.cartItem.upsert({
				where: {
					cartId_productId: { cartId: cartRow.id, productId: product.id },
				},
				create: {
					cartId: cartRow.id,
					productId: product.id,
					quantity: qty,
					addedBy: 'PRACTITIONER',
				},
				update: {
					quantity: { increment: qty },
				},
			});
		} else {
			cartRow = await getOrCreateCart(pr.id, 'SELF', null);
			await prisma.cartItem.upsert({
				where: {
					cartId_productId: { cartId: cartRow.id, productId: product.id },
				},
				create: {
					cartId: cartRow.id,
					productId: product.id,
					quantity: qty,
					addedBy: 'PRACTITIONER',
				},
				update: {
					quantity: { increment: qty },
				},
			});
		}
		const cart = await loadCartFull(cartRow.id);
		return created(res, serializeCart(cart));
	}

	if (req.user.role === 'patient') {
		const patient = await prisma.patient.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!patient || !patient.practitionerId) {
			return badRequest(res, 'No practitioner linked — cannot add to cart');
		}
		const cartRow = await getOrCreateCart(patient.practitionerId, 'PATIENT', patient.id);
		await prisma.cartItem.upsert({
			where: {
				cartId_productId: { cartId: cartRow.id, productId: product.id },
			},
			create: {
				cartId: cartRow.id,
				productId: product.id,
				quantity: qty,
				addedBy: 'PATIENT',
			},
			update: {
				quantity: { increment: qty },
			},
		});
		const cart = await loadCartFull(cartRow.id);
		return created(res, serializeCart(cart));
	}

	return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
});

/** PATCH /carts/items/:itemId */
router.patch('/items/:itemId', authenticateToken, async (req, res) => {
	const itemId = Number(req.params.itemId);
	const quantity = Number(req.body?.quantity);
	if (Number.isNaN(itemId) || Number.isNaN(quantity) || quantity < 1) {
		return badRequest(res, 'Valid quantity required');
	}

	const item = await prisma.cartItem.findUnique({
		where: { id: itemId },
		include: { cart: { include: { patient: true } } },
	});
	if (!item) return res.status(404).json({ success: false, error: { message: 'Cart item not found' } });

	if (req.user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!pr || item.cart.practitionerId !== pr.id) {
			return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
		}
	} else if (req.user.role === 'patient') {
		const patient = await prisma.patient.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!patient || item.cart.patientId !== patient.id) {
			return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
		}
	} else {
		return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}

	await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
	const cart = await loadCartFull(item.cartId);
	return ok(res, serializeCart(cart));
});

/** DELETE /carts/items/:itemId */
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
	const itemId = Number(req.params.itemId);
	if (Number.isNaN(itemId)) return res.status(404).json({ success: false, error: { message: 'Not found' } });

	const item = await prisma.cartItem.findUnique({
		where: { id: itemId },
		include: { cart: true },
	});
	if (!item) return res.status(404).json({ success: false, error: { message: 'Cart item not found' } });

	if (req.user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!pr || item.cart.practitionerId !== pr.id) {
			return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
		}
	} else if (req.user.role === 'patient') {
		const patient = await prisma.patient.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!patient || item.cart.patientId !== patient.id) {
			return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
		}
	} else {
		return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}

	const cartId = item.cartId;
	await prisma.cartItem.delete({ where: { id: itemId } });
	const cart = await loadCartFull(cartId);
	return ok(res, serializeCart(cart));
});

/** POST /carts/checkout */
router.post('/checkout', authenticateToken, async (req, res, next) => {
	try {
		const uid = Number(req.user.userId);
		if (req.user.role === 'practitioner') {
			const { scope, patientUserId } = req.body || {};
			const pr = await prisma.practitioner.findUnique({ where: { userId: uid } });
			if (!pr) return badRequest(res, 'Practitioner profile not found');

			if (scope === 'self' || scope === 'practitioner_self') {
				const cart = await prisma.cart.findFirst({
					where: { practitionerId: pr.id, scope: 'SELF', patientId: null },
					include: { items: true },
				});
				if (!cart?.items?.length) return badRequest(res, 'Cart is empty');
				const result = await createOrder({
					createdByUserId: uid,
					practitionerId: uid,
					patientId: null,
					type: 'practitioner_self',
					items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
				});
				await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
				await prisma.cart.delete({ where: { id: cart.id } });
				return created(res, result);
			}

			if (scope === 'patient' && patientUserId) {
				const patient = await prisma.patient.findFirst({
					where: { userId: Number(patientUserId), practitionerId: pr.id },
				});
				if (!patient) return badRequest(res, 'Patient not found or not assigned to you');
				const cart = await prisma.cart.findFirst({
					where: { practitionerId: pr.id, scope: 'PATIENT', patientId: patient.id },
					include: { items: true },
				});
				if (!cart?.items?.length) return badRequest(res, 'Cart is empty');
				const result = await createOrder({
					createdByUserId: uid,
					practitionerId: uid,
					patientId: Number(patientUserId),
					type: 'patient',
					items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
				});
				await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
				await prisma.cart.delete({ where: { id: cart.id } });
				return created(res, result);
			}
			return badRequest(res, 'scope and patientUserId (for patient orders) required');
		}

		if (req.user.role === 'patient') {
			const patient = await prisma.patient.findUnique({ where: { userId: uid } });
			if (!patient || !patient.practitionerId) return badRequest(res, 'No practitioner linked');
			const cart = await prisma.cart.findFirst({
				where: { practitionerId: patient.practitionerId, scope: 'PATIENT', patientId: patient.id },
				include: { items: true },
			});
			if (!cart?.items?.length) return badRequest(res, 'Cart is empty');
			const prUser = await prisma.practitioner.findUnique({
				where: { id: patient.practitionerId },
				select: { userId: true },
			});
			const result = await createOrder({
				createdByUserId: uid,
				practitionerId: prUser.userId,
				patientId: uid,
				type: 'patient',
				items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
			});
			await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
			await prisma.cart.delete({ where: { id: cart.id } });
			return created(res, result);
		}

		return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	} catch (e) {
		if (e.status) return res.status(e.status).json({ success: false, error: { message: e.message } });
		return next(e);
	}
});

module.exports = router;
