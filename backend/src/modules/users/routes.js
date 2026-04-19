const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { parsePagination, paginateResult } = require('../../utils/pagination');
const bcrypt = require('bcryptjs');
const { toDbRole, toApiRole } = require('../../lib/roles');
const { normalizeEmail } = require('../../lib/email');

const router = Router();

router.get('/me', authenticateToken, async (req, res) => {
	const user = await prisma.user.findUnique({ where: { id: Number(req.user.userId) } });
	if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
	return ok(res, {
		id: user.id,
		role: toApiRole(user.role),
		name: user.name,
		email: user.email,
	});
});

router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
	const { page, pageSize } = parsePagination(req.query);
	const total = await prisma.user.count();
	const skip = (page - 1) * pageSize;
	const rows = await prisma.user.findMany({
		orderBy: { id: 'asc' },
		skip,
		take: pageSize,
		select: { id: true, email: true, name: true, role: true },
	});
	const users = rows.map((u) => ({
		id: u.id,
		email: u.email,
		name: u.name,
		role: toApiRole(u.role),
	}));
	return ok(res, paginateResult(users, page, pageSize, total));
});

router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
	const { name, role, password } = req.body || {};
	const email = normalizeEmail(req.body?.email);
	if (!email || !name || !role || !password) return badRequest(res, 'email, name, role, password required');
	if (!['admin', 'practitioner', 'patient'].includes(role)) return badRequest(res, 'Invalid role');
	const dbRole = toDbRole(role);
	if (!dbRole) return badRequest(res, 'Invalid role');

	const exists = await prisma.user.findUnique({ where: { email } });
	if (exists) return badRequest(res, 'Email already exists');

	const hash = bcrypt.hashSync(password, 10);

	const user = await prisma.$transaction(async (tx) => {
		const u = await tx.user.create({
			data: { email, name, password: hash, role: dbRole },
		});
		if (role === 'practitioner') {
			await tx.practitioner.create({ data: { userId: u.id } });
		} else if (role === 'patient') {
			await tx.patient.create({ data: { userId: u.id } });
		}
		return u;
	});

	return created(res, {
		id: user.id,
		email: user.email,
		name: user.name,
		role: toApiRole(user.role),
	});
});

router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return res.status(404).json({ success: false, error: { message: 'User not found' } });

	const existing = await prisma.user.findUnique({ where: { id } });
	if (!existing) return res.status(404).json({ success: false, error: { message: 'User not found' } });

	const { name, role, password } = req.body || {};
	const email =
		req.body?.email != null && req.body.email !== '' ? normalizeEmail(req.body.email) : null;
	if (role != null) {
		const next = toDbRole(role);
		if (!next) return badRequest(res, 'Invalid role');
		if (next !== existing.role) return badRequest(res, 'Role cannot be changed via this endpoint');
	}

	if (email != null && email !== normalizeEmail(existing.email)) {
		const clash = await prisma.user.findFirst({ where: { email, NOT: { id } } });
		if (clash) return badRequest(res, 'Email already exists');
	}

	const data = {};
	if (email != null) data.email = email;
	if (name != null) data.name = name;
	if (password) data.password = bcrypt.hashSync(password, 10);

	const user = await prisma.user.update({
		where: { id },
		data,
	});

	return ok(res, {
		id: user.id,
		email: user.email,
		name: user.name,
		role: toApiRole(user.role),
	});
});

module.exports = router;
