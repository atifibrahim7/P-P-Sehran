const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { parsePagination, paginateResult } = require('../../utils/pagination');

const router = Router();

function apiTypeToDb(t) {
	if (t === 'lab') return 'LAB';
	if (t === 'supplement') return 'SUPPLEMENT';
	return null;
}

function dbTypeToApi(t) {
	if (t === 'LAB') return 'lab';
	if (t === 'SUPPLEMENT') return 'supplement';
	return t;
}

router.get('/', authenticateToken, async (req, res) => {
	const { page, pageSize } = parsePagination(req.query);
	const total = await prisma.vendor.count();
	const skip = (page - 1) * pageSize;
	const rows = await prisma.vendor.findMany({
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
	if (!name || !type || !['lab', 'supplement'].includes(type)) {
		return badRequest(res, 'name and valid type (lab|supplement) are required');
	}
	const dbType = apiTypeToDb(type);
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
		if (!['lab', 'supplement'].includes(type)) return badRequest(res, 'type must be lab|supplement');
		data.type = apiTypeToDb(type);
	}

	const vendor = await prisma.vendor.update({ where: { id }, data });
	return ok(res, { id: vendor.id, name: vendor.name, type: dbTypeToApi(vendor.type) });
});

module.exports = router;
