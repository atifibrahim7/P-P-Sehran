const { Router } = require('express');
const { ok, created, badRequest, conflict } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { orderedGalleryUrls } = require('../../lib/productGallery');
const { parsePositiveInt } = require('../../utils/quantity');
const { createOrder } = require('../orders/service');

const router = Router();
const LAB_TEST_CATEGORY_DB_BY_API = {
	home_kit: 'HOME_KIT',
	lab_visit: 'LAB_VISIT',
	phlebotomy: 'PHLEBOTOMY',
};
const LAB_TEST_CATEGORY_API_BY_DB = {
	HOME_KIT: 'home_kit',
	LAB_VISIT: 'lab_visit',
	PHLEBOTOMY: 'phlebotomy',
};

function parseLabTestCategory(input) {
	if (input == null || input === '') return null;
	const key = String(input).trim().toLowerCase();
	return LAB_TEST_CATEGORY_DB_BY_API[key] || null;
}

function productMini(p) {
	if (!p) return null;
	const vendor = p.vendor;
	const imageUrls = orderedGalleryUrls(p);
	const primary = imageUrls[0] || null;
	return {
		id: p.id,
		name: p.name,
		description: p.description || '',
		category: p.category === 'BLOOD_TEST' ? 'lab_test' : 'supplement',
		type: p.category === 'BLOOD_TEST' ? 'lab_test' : 'supplement',
		patient_price: Number(p.patientPrice),
		practitioner_price: Number(p.practitionerPrice),
		price: Number(p.patientPrice),
		imageLink: primary,
		imageUrls,
		vendorId: p.vendorId,
		vendorName: vendor?.name ?? null,
	};
}

function serializeCartItem(row) {
	return {
		id: row.id,
		productId: row.productId,
		quantity: row.quantity,
		addedBy: row.addedBy === 'PRACTITIONER' ? 'practitioner' : 'patient',
		labTestCategory: row.labTestCategory ? LAB_TEST_CATEGORY_API_BY_DB[row.labTestCategory] || null : null,
		product: productMini(row.product),
	};
}

function serializeCart(cart) {
	if (!cart) return null;
	let scopeOut = 'patient';
	if (cart.scope === 'SELF') scopeOut = 'self';
	else if (cart.scope === 'PATIENT_DIRECT') scopeOut = 'patient_direct';
	return {
		id: cart.id,
		scope: scopeOut,
		practitionerId: cart.practitionerId,
		patientId: cart.patientId,
		patientUserId: cart.patient?.userId ?? null,
		items: (cart.items || []).map(serializeCartItem),
		updatedAt: cart.updatedAt,
	};
}

function computeCartMoney(serializedCart) {
	const items = serializedCart?.items || [];
	let totalItemQty = 0;
	let patientSubtotal = 0;
	let practitionerSubtotal = 0;
	let estimatedCommission = 0;
	for (const it of items) {
		const q = Number(it.quantity) || 0;
		totalItemQty += q;
		const p = it.product;
		const pp = Number(p?.patient_price ?? p?.price ?? 0);
		const pr = Number(p?.practitioner_price ?? p?.price ?? 0);
		patientSubtotal += pp * q;
		practitionerSubtotal += pr * q;
		estimatedCommission += Math.max(0, pp - pr) * q;
	}
	return { totalItemQty, patientSubtotal, practitionerSubtotal, estimatedCommission };
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

/** Cart for patients with no linked practitioner — standalone ordering. */
async function getOrCreatePatientDirectCart(patientProfileId) {
	let cart = await prisma.cart.findFirst({
		where: { practitionerId: null, scope: 'PATIENT_DIRECT', patientId: patientProfileId },
	});
	if (!cart) {
		cart = await prisma.cart.create({
			data: {
				practitionerId: null,
				scope: 'PATIENT_DIRECT',
				patientId: patientProfileId,
			},
		});
	}
	return cart;
}

async function ensurePatientProfile(userId) {
	const user = await prisma.user.findFirst({ where: { id: Number(userId), role: 'PATIENT', deletedAt: null } });
	if (!user) return null;

	let patient = await prisma.patient.findFirst({ where: { userId: Number(userId), deletedAt: null } });
	if (!patient) {
		patient = await prisma.patient.create({
			data: { userId: Number(userId), practitionerId: null },
		});
	}
	return patient;
}

async function loadCartFull(cartId) {
	return prisma.cart.findUnique({
		where: { id: cartId },
		include: {
			items: {
				include: {
					product: { include: { vendor: true, productImages: { orderBy: { sortOrder: 'asc' } } } },
				},
			},
			patient: true,
		},
	});
}

/**
 * Ensures all cart lines share one vendor. Returns false and sends 409 if the new product's vendor differs.
 */
async function checkVendorOrConflict(res, cartId, newVendorId) {
	const cart = await prisma.cart.findUnique({
		where: { id: cartId },
		include: { items: { include: { product: { select: { vendorId: true } } } } },
	});
	if (!cart?.items?.length) return true;
	const existing = cart.items[0].product.vendorId;
	if (existing === newVendorId) return true;
	const [vExisting, vNew] = await Promise.all([
		prisma.vendor.findUnique({ where: { id: existing } }),
		prisma.vendor.findUnique({ where: { id: newVendorId } }),
	]);
	conflict(res, 'Cart already contains products from a different vendor', 'VENDOR_CONFLICT', {
		existingVendor: { id: existing, name: vExisting?.name ?? `Vendor #${existing}` },
		newVendor: { id: newVendorId, name: vNew?.name ?? `Vendor #${newVendorId}` },
	});
	return false;
}

/** GET /carts/summary — practitioner: all self + patient carts with line totals and commission estimates */
router.get('/summary', authenticateToken, async (req, res) => {
	if (req.user.role !== 'practitioner') {
		return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}
	const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
	if (!pr) return badRequest(res, 'Practitioner profile not found');

	const carts = await prisma.cart.findMany({
		where: { practitionerId: pr.id },
		include: {
			items: {
				include: {
					product: { include: { vendor: true, productImages: { orderBy: { sortOrder: 'asc' } } } },
				},
			},
			patient: { include: { user: { select: { id: true, name: true, email: true } } } },
		},
	});

	let self = {
		cart: null,
		totalItemQty: 0,
		patientSubtotal: 0,
		practitionerSubtotal: 0,
		estimatedCommission: 0,
	};
	const patients = [];

	for (const c of carts) {
		const ser = serializeCart(c);
		const m = computeCartMoney(ser);
		if (c.scope === 'SELF') {
			self = {
				cart: ser,
				totalItemQty: m.totalItemQty,
				patientSubtotal: m.patientSubtotal,
				practitionerSubtotal: m.practitionerSubtotal,
				estimatedCommission: 0,
			};
		} else if (c.scope === 'PATIENT' && c.patient?.user) {
			patients.push({
				patientUserId: c.patient.userId,
				patientName: c.patient.user.name,
				patientEmail: c.patient.user.email,
				cart: ser,
				totalItemQty: m.totalItemQty,
				patientSubtotal: m.patientSubtotal,
				practitionerSubtotal: m.practitionerSubtotal,
				estimatedCommission: m.estimatedCommission,
			});
		}
	}

	patients.sort((a, b) => String(a.patientName || '').localeCompare(String(b.patientName || '')));

	const aggregate = {
		totalItemQty: self.totalItemQty + patients.reduce((s, p) => s + p.totalItemQty, 0),
		selfQty: self.totalItemQty,
		forPatientsQty: patients.reduce((s, p) => s + p.totalItemQty, 0),
	};

	return ok(res, { self, patients, aggregate });
});

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
				where: { userId: forPatientUserId, deletedAt: null, user: { deletedAt: null } },
				include: { user: true },
			});
			if (!patient) return badRequest(res, 'Patient not found for this user id');
			const c = await getOrCreateCart(pr.id, 'PATIENT', patient.id);
			cart = await loadCartFull(c.id);
		} else {
			const c = await getOrCreateCart(pr.id, 'SELF', null);
			cart = await loadCartFull(c.id);
		}
		return ok(res, { cart: serializeCart(cart) });
	}
	if (role === 'patient') {
		const patient = await ensurePatientProfile(req.user.userId);
		if (!patient) return res.status(403).json({ success: false, error: { message: 'Patient profile not found' } });
		const c = patient.practitionerId
			? await getOrCreateCart(patient.practitionerId, 'PATIENT', patient.id)
			: await getOrCreatePatientDirectCart(patient.id);
		const cart = await loadCartFull(c.id);
		return ok(res, { cart: serializeCart(cart) });
	}
	return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
});

/** POST /carts/clear — remove all line items from the active cart */
router.post('/clear', authenticateToken, async (req, res) => {
	if (req.user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!pr) return badRequest(res, 'Practitioner profile not found');
		const forPatientUserId = req.body?.forPatientUserId != null ? Number(req.body.forPatientUserId) : null;
		let cartRow;
		if (forPatientUserId) {
			const patient = await prisma.patient.findFirst({
				where: { userId: forPatientUserId, deletedAt: null, user: { deletedAt: null } },
			});
			if (!patient) return badRequest(res, 'Patient not found for this user id');
			cartRow = await getOrCreateCart(pr.id, 'PATIENT', patient.id);
		} else {
			cartRow = await getOrCreateCart(pr.id, 'SELF', null);
		}
		await prisma.cartItem.deleteMany({ where: { cartId: cartRow.id } });
		const cart = await loadCartFull(cartRow.id);
		return ok(res, { cart: serializeCart(cart) });
	}
	if (req.user.role === 'patient') {
		const patient = await ensurePatientProfile(req.user.userId);
		if (!patient) return res.status(403).json({ success: false, error: { message: 'Patient profile not found' } });
		const cartRow = patient.practitionerId
			? await getOrCreateCart(patient.practitionerId, 'PATIENT', patient.id)
			: await getOrCreatePatientDirectCart(patient.id);
		await prisma.cartItem.deleteMany({ where: { cartId: cartRow.id } });
		const cart = await loadCartFull(cartRow.id);
		return ok(res, { cart: serializeCart(cart) });
	}
	return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
});

/** POST /carts/items */
router.post('/items', authenticateToken, async (req, res) => {
	const { productId, quantity } = req.body || {};
	const parsedLabTestCategory = parseLabTestCategory(req.body?.labTestCategory);
	let qty;
	try {
		qty = parsePositiveInt(quantity, 1);
	} catch (e) {
		return badRequest(res, e.message || 'Invalid quantity');
	}
	if (!productId) return badRequest(res, 'productId required');

	const product = await prisma.product.findUnique({
		where: { id: Number(productId) },
		include: { vendor: true },
	});
	if (!product) return badRequest(res, 'Product not found');
	if (req.body?.labTestCategory != null && req.body?.labTestCategory !== '' && !parsedLabTestCategory) {
		return badRequest(res, 'labTestCategory must be home_kit, lab_visit, or phlebotomy');
	}
	if (parsedLabTestCategory && product.category !== 'BLOOD_TEST') {
		return badRequest(res, 'labTestCategory is only valid for lab tests');
	}
	const labTestCategory = product.category === 'BLOOD_TEST' ? parsedLabTestCategory : null;

	if (req.user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
		if (!pr) return badRequest(res, 'Practitioner profile not found');
		const forPatientUserId = req.body.forPatientUserId != null ? Number(req.body.forPatientUserId) : null;

		let cartRow;
		if (forPatientUserId) {
			const patient = await prisma.patient.findFirst({
				where: { userId: forPatientUserId, deletedAt: null, user: { deletedAt: null } },
			});
			if (!patient) return badRequest(res, 'Patient not found for this user id');
			cartRow = await getOrCreateCart(pr.id, 'PATIENT', patient.id);
			if (!(await checkVendorOrConflict(res, cartRow.id, product.vendorId))) return;
			await prisma.cartItem.upsert({
				where: {
					cartId_productId: { cartId: cartRow.id, productId: product.id },
				},
				create: {
					cartId: cartRow.id,
					productId: product.id,
					quantity: qty,
					addedBy: 'PRACTITIONER',
					labTestCategory,
				},
				update: {
					quantity: { increment: qty },
					...(labTestCategory ? { labTestCategory } : {}),
				},
			});
		} else {
			cartRow = await getOrCreateCart(pr.id, 'SELF', null);
			if (!(await checkVendorOrConflict(res, cartRow.id, product.vendorId))) return;
			await prisma.cartItem.upsert({
				where: {
					cartId_productId: { cartId: cartRow.id, productId: product.id },
				},
				create: {
					cartId: cartRow.id,
					productId: product.id,
					quantity: qty,
					addedBy: 'PRACTITIONER',
					labTestCategory,
				},
				update: {
					quantity: { increment: qty },
					...(labTestCategory ? { labTestCategory } : {}),
				},
			});
		}
		const cart = await loadCartFull(cartRow.id);
		return created(res, serializeCart(cart));
	}

	if (req.user.role === 'patient') {
		const patient = await ensurePatientProfile(req.user.userId);
		if (!patient) return res.status(403).json({ success: false, error: { message: 'Patient profile not found' } });
		const cartRow = patient.practitionerId
			? await getOrCreateCart(patient.practitionerId, 'PATIENT', patient.id)
			: await getOrCreatePatientDirectCart(patient.id);
		if (!(await checkVendorOrConflict(res, cartRow.id, product.vendorId))) return;
		await prisma.cartItem.upsert({
			where: {
				cartId_productId: { cartId: cartRow.id, productId: product.id },
			},
			create: {
				cartId: cartRow.id,
				productId: product.id,
				quantity: qty,
				addedBy: 'PATIENT',
				labTestCategory,
			},
			update: {
				quantity: { increment: qty },
				...(labTestCategory ? { labTestCategory } : {}),
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
	let quantity;
	try {
		quantity = parsePositiveInt(req.body?.quantity, null);
	} catch (e) {
		return badRequest(res, e.message || 'Valid quantity required');
	}
	if (Number.isNaN(itemId)) {
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
		const patient = await prisma.patient.findFirst({
			where: { userId: Number(req.user.userId), deletedAt: null, user: { deletedAt: null } },
		});
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
		const patient = await prisma.patient.findFirst({
			where: { userId: Number(req.user.userId), deletedAt: null, user: { deletedAt: null } },
		});
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
					where: { userId: Number(patientUserId), deletedAt: null, user: { deletedAt: null } },
				});
				if (!patient) return badRequest(res, 'Patient not found for this user id');
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
			const patient = await ensurePatientProfile(uid);
			if (!patient) return res.status(403).json({ success: false, error: { message: 'Patient profile not found' } });
			const cart = patient.practitionerId
				? await prisma.cart.findFirst({
						where: {
							practitionerId: patient.practitionerId,
							scope: 'PATIENT',
							patientId: patient.id,
						},
						include: { items: true },
					})
				: await prisma.cart.findFirst({
						where: {
							practitionerId: null,
							scope: 'PATIENT_DIRECT',
							patientId: patient.id,
						},
						include: { items: true },
					});
			if (!cart?.items?.length) return badRequest(res, 'Cart is empty');

			const result = await createOrder({
				createdByUserId: uid,
				practitionerId: null,
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
