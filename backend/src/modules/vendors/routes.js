const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { parsePagination, paginateResult } = require('../../utils/pagination');

const router = Router();

const VALID_VENDOR_TYPES = ['lab', 'supplement', 'both'];

function apiTypeToDb(t) {
	if (t === 'lab') return 'LAB';
	if (t === 'supplement') return 'SUPPLEMENT';
	if (t === 'both') return 'BOTH';
	return null;
}

function dbTypeToApi(t) {
	if (t === 'LAB') return 'lab';
	if (t === 'SUPPLEMENT') return 'supplement';
	if (t === 'BOTH') return 'both';
	return t;
}

/** Filter vendors usable for product category side: lab → LAB or BOTH; supplement → SUPPLEMENT or BOTH. */
function listWhereForProductType(typeParam) {
	if (typeParam === 'lab') {
		return { OR: [{ type: 'LAB' }, { type: 'BOTH' }] };
	}
	if (typeParam === 'supplement') {
		return { OR: [{ type: 'SUPPLEMENT' }, { type: 'BOTH' }] };
	}
	return {};
}

router.get('/', authenticateToken, async (req, res) => {
	const { page, pageSize } = parsePagination(req.query);
	const filterType = req.query?.type != null ? String(req.query.type).toLowerCase() : null;
	const typeFilter =
		filterType === 'lab' || filterType === 'supplement' ? listWhereForProductType(filterType) : {};

	const where = Object.keys(typeFilter).length ? typeFilter : {};

	const total = await prisma.vendor.count({ where });
	const skip = (page - 1) * pageSize;
	const rows = await prisma.vendor.findMany({
		where,
		orderBy: { id: 'asc' },
		skip,
		take: pageSize,
	});
	const vendors = rows.map((v) => ({
		id: v.id,
		name: v.name,
		type: dbTypeToApi(v.type),
	}));
	return ok(res, paginateResult(vendors, page, pageSize, total));
});

router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
	const { name, type } = req.body || {};
	if (!name || !type || !VALID_VENDOR_TYPES.includes(type)) {
		return badRequest(res, 'name and valid type (lab|supplement|both) are required');
	}
	const dbType = apiTypeToDb(type);
	if (!dbType) return badRequest(res, 'Invalid type');
	const vendor = await prisma.vendor.create({
		data: { name, type: dbType },
	});
	return created(res, { id: vendor.id, name: vendor.name, type: dbTypeToApi(vendor.type) });
});

router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return res.status(404).json({ success: false, error: { message: 'Vendor not found' } });

	const existing = await prisma.vendor.findUnique({ where: { id } });
	if (!existing) return res.status(404).json({ success: false, error: { message: 'Vendor not found' } });

	const { name, type } = req.body || {};
	const data = {};
	if (name != null) data.name = name;
	if (type != null) {
		if (!VALID_VENDOR_TYPES.includes(type)) return badRequest(res, 'type must be lab|supplement|both');
		const dbT = apiTypeToDb(type);
		if (!dbT) return badRequest(res, 'Invalid type');
		data.type = dbT;
	}

	const vendor = await prisma.vendor.update({ where: { id }, data });
	return ok(res, { id: vendor.id, name: vendor.name, type: dbTypeToApi(vendor.type) });
});

module.exports = router;
