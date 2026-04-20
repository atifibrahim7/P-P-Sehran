const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { parsePagination, paginateResult } = require('../../utils/pagination');

const router = Router();
const VALID_CATEGORIES = ['lab_test', 'supplement'];

function normalizeCategory(input) {
	if (!input) return null;
	if (input === 'blood_test') return 'lab_test';
	return input;
}

function apiCategoryToDb(input) {
	const c = normalizeCategory(input);
	if (c === 'lab_test') return 'BLOOD_TEST';
	if (c === 'supplement') return 'SUPPLEMENT';
	return null;
}

function dbCategoryToApi(cat) {
	if (cat === 'BLOOD_TEST') return 'lab_test';
	if (cat === 'SUPPLEMENT') return 'supplement';
	return cat;
}

function dbCategoryToVendorType(dbCat) {
	if (dbCat === 'BLOOD_TEST') return 'LAB';
	if (dbCat === 'SUPPLEMENT') return 'SUPPLEMENT';
	return null;
}

function vendorCanSupplyCategory(vendor, dbCat) {
	if (!vendor) return false;
	if (dbCat === 'BLOOD_TEST') return vendor.type === 'LAB' || vendor.type === 'BOTH';
	if (dbCat === 'SUPPLEMENT') return vendor.type === 'SUPPLEMENT' || vendor.type === 'BOTH';
	return false;
}

async function resolveVendorIdForCategory(dbCat) {
	const vType = dbCategoryToVendorType(dbCat);
	if (!vType) return null;
	const vendor = await prisma.vendor.findFirst({
		where: { OR: [{ type: vType }, { type: 'BOTH' }] },
		orderBy: { id: 'asc' },
	});
	return vendor?.id ?? null;
}

function defaultImageLink(category) {
	const label = category === 'supplement' ? 'Supplement' : 'Lab+Test';
	return `https://dummyimage.com/600x400/e5e7eb/1f2937.png&text=${label}`;
}

function numericPriceField(v) {
	if (v === null || v === undefined || v === '') return undefined;
	const n = Number(v);
	if (Number.isNaN(n)) return NaN;
	return n;
}

/** Returns { patientPrice, practitionerPrice } or { error: string }. Legacy: single `price` sets both. */
function resolveCreatePrices(body) {
	const pp = numericPriceField(body?.patient_price ?? body?.patientPrice);
	const pr = numericPriceField(body?.practitioner_price ?? body?.practitionerPrice);
	const single = numericPriceField(body?.price);
	if (pp !== undefined && pr !== undefined) {
		if (Number.isNaN(pp) || Number.isNaN(pr)) {
			return { error: 'patient_price and practitioner_price must be numbers' };
		}
		if (pp < 0 || pr < 0) {
			return { error: 'Prices must be non-negative' };
		}
		return { patientPrice: pp, practitionerPrice: pr };
	}
	if (single !== undefined) {
		if (Number.isNaN(single) || single < 0) {
			return { error: 'price must be a non-negative number' };
		}
		return { patientPrice: single, practitionerPrice: single };
	}
	return { error: 'Provide patient_price and practitioner_price, or a single price' };
}

function withComputedFields(product) {
	const normalizedCategory = dbCategoryToApi(product.category);
	const price = Number(product.patientPrice ?? 0);
	return {
		id: product.id,
		name: product.name,
		description: product.description || '',
		category: normalizedCategory,
		type: normalizedCategory,
		price,
		patient_price: Number(product.patientPrice ?? price),
		practitioner_price: Number(product.practitionerPrice ?? price),
		vendorId: product.vendorId,
		vendorName: product.vendor?.name ?? null,
		imageLink: product.imageUrl || defaultImageLink(normalizedCategory),
		imageUrl: product.imageUrl,
	};
}

router.get('/', authenticateToken, async (req, res) => {
	const { type, category, vendorId, search } = req.query;
	const categoryFilter = normalizeCategory(type || category);
	const { page, pageSize } = parsePagination(req.query);

	const where = {};
	if (categoryFilter) {
		const dbCat = apiCategoryToDb(categoryFilter);
		if (dbCat) where.category = dbCat;
	}
	if (vendorId) where.vendorId = Number(vendorId);
	if (search) {
		where.OR = [
			{ name: { contains: String(search) } },
			{ description: { contains: String(search) } },
		];
	}

	const total = await prisma.product.count({ where });
	const skip = (page - 1) * pageSize;
	const rows = await prisma.product.findMany({
		where,
		include: { vendor: true },
		orderBy: { id: 'asc' },
		skip,
		take: pageSize,
	});
	const products = rows.map(withComputedFields);
	return ok(res, paginateResult(products, page, pageSize, total));
});

router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
	const { name, description, imageLink } = req.body || {};
	const category = normalizeCategory(req.body?.category || req.body?.type);
	const prices = resolveCreatePrices(req.body || {});
	if (prices.error) {
		return badRequest(res, prices.error);
	}
	if (!name || !category) {
		return badRequest(res, 'name and category/type required');
	}
	if (!VALID_CATEGORIES.includes(category)) {
		return badRequest(res, 'category/type must be lab_test or supplement');
	}
	const dbCat = apiCategoryToDb(category);
	if (!dbCat) return badRequest(res, 'Invalid category');

	const expectedVendorType = dbCategoryToVendorType(dbCat);
	let vendorId = req.body?.vendorId != null ? Number(req.body.vendorId) : null;
	if (vendorId) {
		const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
		if (!vendor) return badRequest(res, 'Invalid vendorId');
		if (!vendorCanSupplyCategory(vendor, dbCat)) {
			return badRequest(res, 'Vendor cannot supply this product category (lab vs supplement)');
		}
	} else {
		vendorId = await resolveVendorIdForCategory(dbCat);
		if (!vendorId) {
			const label = expectedVendorType === 'LAB' ? 'lab' : 'supplement';
			return badRequest(
				res,
				`No ${label} vendor found. Create one under Vendors first, or pass vendorId explicitly.`,
			);
		}
	}

	const product = await prisma.product.create({
		data: {
			name,
			description: description || null,
			category: dbCat,
			vendorId,
			patientPrice: prices.patientPrice,
			practitionerPrice: prices.practitionerPrice,
			imageUrl: imageLink || null,
		},
		include: { vendor: true },
	});

	return created(res, withComputedFields(product));
});

router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return res.status(404).json({ success: false, error: { message: 'Product not found' } });

	const existing = await prisma.product.findUnique({ where: { id } });
	if (!existing) return res.status(404).json({ success: false, error: { message: 'Product not found' } });

	const nextCategory = normalizeCategory(req.body?.category || req.body?.type || dbCategoryToApi(existing.category));
	if (!VALID_CATEGORIES.includes(nextCategory)) {
		return badRequest(res, 'category/type must be lab_test or supplement');
	}
	const dbCat = apiCategoryToDb(nextCategory);
	if (!dbCat) return badRequest(res, 'Invalid category');

	const data = { category: dbCat };
	const categoryChanged = dbCat !== existing.category;

	if (req.body?.vendorId != null) {
		const vendor = await prisma.vendor.findUnique({ where: { id: Number(req.body.vendorId) } });
		if (!vendor) return badRequest(res, 'Invalid vendorId');
		if (!vendorCanSupplyCategory(vendor, dbCat)) {
			return badRequest(res, 'Vendor cannot supply this product category');
		}
		data.vendorId = Number(req.body.vendorId);
	} else if (categoryChanged) {
		const resolved = await resolveVendorIdForCategory(dbCat);
		if (!resolved) {
			const expectedVendorType = dbCategoryToVendorType(dbCat);
			const label = expectedVendorType === 'LAB' ? 'lab' : 'supplement';
			return badRequest(res, `No ${label} vendor found. Create one under Vendors first.`);
		}
		data.vendorId = resolved;
	}
	if (req.body?.name != null) data.name = req.body.name;
	if (req.body?.description != null) data.description = req.body.description;
	if (req.body?.imageLink != null) data.imageUrl = req.body.imageLink;

	const hasPatient =
		req.body?.patient_price !== undefined || req.body?.patientPrice !== undefined;
	const hasPractitioner =
		req.body?.practitioner_price !== undefined || req.body?.practitionerPrice !== undefined;
	if (hasPatient) {
		const v = Number(req.body.patient_price ?? req.body.patientPrice);
		if (Number.isNaN(v) || v < 0) return badRequest(res, 'patient_price must be a non-negative number');
		data.patientPrice = v;
	}
	if (hasPractitioner) {
		const v = Number(req.body.practitioner_price ?? req.body.practitionerPrice);
		if (Number.isNaN(v) || v < 0) return badRequest(res, 'practitioner_price must be a non-negative number');
		data.practitionerPrice = v;
	}
	if (req.body?.price != null && !hasPatient && !hasPractitioner) {
		const parsedPrice = Number(req.body.price);
		if (Number.isNaN(parsedPrice) || parsedPrice < 0) return badRequest(res, 'price must be a non-negative number');
		data.patientPrice = parsedPrice;
		data.practitionerPrice = parsedPrice;
	}

	const product = await prisma.product.update({
		where: { id },
		data,
		include: { vendor: true },
	});
	return ok(res, withComputedFields(product));
});

router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return res.status(404).json({ success: false, error: { message: 'Product not found' } });

	try {
		const removed = await prisma.product.delete({ where: { id } });
		return ok(res, withComputedFields(removed));
	} catch (_e) {
		return res.status(404).json({ success: false, error: { message: 'Product not found' } });
	}
});

module.exports = router;
