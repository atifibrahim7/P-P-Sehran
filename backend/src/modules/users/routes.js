const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { parsePagination, paginateResult } = require('../../utils/pagination');
const bcrypt = require('bcryptjs');
const { toDbRole, toApiRole } = require('../../lib/roles');
const { normalizeEmail } = require('../../lib/email');
const { parsePractitionerProfilePayload, serializePractitionerProfile } = require('../../lib/practitionerProfilePayload');

const router = Router();

router.get('/me', authenticateToken, async (req, res) => {
	const user = await prisma.user.findFirst({ where: { id: Number(req.user.userId), deletedAt: null } });
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
	const total = await prisma.user.count({ where: { deletedAt: null } });
	const skip = (page - 1) * pageSize;
	const rows = await prisma.user.findMany({
		where: { deletedAt: null },
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

router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return res.status(404).json({ success: false, error: { message: 'User not found' } });

	const user = await prisma.user.findUnique({
		where: { id },
		include: {
			practitioner: { include: { addresses: true, contacts: true } },
		},
	});
	if (!user || user.deletedAt) return res.status(404).json({ success: false, error: { message: 'User not found' } });

	const out = {
		id: user.id,
		email: user.email,
		name: user.name,
		role: toApiRole(user.role),
	};
	if (user.role === 'PRACTITIONER' && user.practitioner) {
		out.practitionerProfile = serializePractitionerProfile(user.practitioner);
	}
	return ok(res, out);
});

router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
	const { name, role, password, practitionerProfile } = req.body || {};
	const email = normalizeEmail(req.body?.email);
	if (!email || !name || !role || !password) return badRequest(res, 'email, name, role, password required');
	if (!['admin', 'practitioner', 'patient'].includes(role)) return badRequest(res, 'Invalid role');
	const dbRole = toDbRole(role);
	if (!dbRole) return badRequest(res, 'Invalid role');

	const exists = await prisma.user.findFirst({ where: { email, deletedAt: null } });
	if (exists) return badRequest(res, 'Email already exists');

	const hash = bcrypt.hashSync(password, 10);

	if (role === 'practitioner') {
		const parsed = parsePractitionerProfilePayload(practitionerProfile);
		if (!parsed.ok) return badRequest(res, parsed.message);
		const p = parsed.data;

		try {
			const user = await prisma.$transaction(async (tx) => {
				const u = await tx.user.create({
					data: { email, name, password: hash, role: dbRole },
				});
				const pr = await tx.practitioner.create({
					data: {
						userId: u.id,
						title: p.title,
						forenames: p.forenames,
						surname: p.surname,
						dateOfBirth: p.dateOfBirth,
						gender: p.gender,
						policyNumber: p.policyNumber,
						clientReference2: p.clientReference2,
						nationalInsuranceNumber: p.nationalInsuranceNumber,
						smokerStatus: p.smokerStatus,
					},
				});
				if (p.addresses.length) {
					await tx.practitionerAddress.createMany({
						data: p.addresses.map((a) => ({ ...a, practitionerId: pr.id })),
					});
				}
				if (p.contacts.length) {
					await tx.practitionerContact.createMany({
						data: p.contacts.map((c) => ({ ...c, practitionerId: pr.id })),
					});
				}
				return u;
			});
			const full = await prisma.user.findUnique({
				where: { id: user.id },
				include: { practitioner: { include: { addresses: true, contacts: true } } },
			});
			return created(res, {
				id: full.id,
				email: full.email,
				name: full.name,
				role: toApiRole(full.role),
				practitionerProfile: serializePractitionerProfile(full.practitioner),
			});
		} catch (e) {
			if (e && e.code === 'P2002') {
				const target = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target || '');
				if (target.includes('policyNumber')) return badRequest(res, 'Policy number already exists');
				return badRequest(res, 'Unique field already exists');
			}
			throw e;
		}
	}

	const user = await prisma.$transaction(async (tx) => {
		const u = await tx.user.create({
			data: { email, name, password: hash, role: dbRole },
		});
		if (role === 'patient') {
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

	const existing = await prisma.user.findUnique({
		where: { id },
		include: { practitioner: true },
	});
	if (!existing || existing.deletedAt) return res.status(404).json({ success: false, error: { message: 'User not found' } });

	const { name, role, password, practitionerProfile } = req.body || {};
	const email =
		req.body?.email != null && req.body.email !== '' ? normalizeEmail(req.body.email) : null;
	if (role != null) {
		const next = toDbRole(role);
		if (!next) return badRequest(res, 'Invalid role');
		if (next !== existing.role) return badRequest(res, 'Role cannot be changed via this endpoint');
	}

	if (email != null && email !== normalizeEmail(existing.email)) {
		const clash = await prisma.user.findFirst({ where: { email, deletedAt: null, NOT: { id } } });
		if (clash) return badRequest(res, 'Email already exists');
	}

	const data = {};
	if (email != null) data.email = email;
	if (name != null) data.name = name;
	if (password) data.password = bcrypt.hashSync(password, 10);

	if (existing.role === 'PRACTITIONER' && practitionerProfile != null) {
		const parsed = parsePractitionerProfilePayload(practitionerProfile);
		if (!parsed.ok) return badRequest(res, parsed.message);
		const p = parsed.data;
		try {
			await prisma.$transaction(async (tx) => {
				if (Object.keys(data).length > 0) {
					await tx.user.update({ where: { id }, data });
				}
				if (!existing.practitioner) {
					await tx.practitioner.create({
						data: {
							userId: id,
							title: p.title,
							forenames: p.forenames,
							surname: p.surname,
							dateOfBirth: p.dateOfBirth,
							gender: p.gender,
							policyNumber: p.policyNumber,
							clientReference2: p.clientReference2,
							nationalInsuranceNumber: p.nationalInsuranceNumber,
							smokerStatus: p.smokerStatus,
						},
					});
				} else {
					await tx.practitioner.update({
						where: { userId: id },
						data: {
							title: p.title,
							forenames: p.forenames,
							surname: p.surname,
							dateOfBirth: p.dateOfBirth,
							gender: p.gender,
							policyNumber: p.policyNumber,
							clientReference2: p.clientReference2,
							nationalInsuranceNumber: p.nationalInsuranceNumber,
							smokerStatus: p.smokerStatus,
						},
					});
				}
				const pr = await tx.practitioner.findUnique({ where: { userId: id } });
				await tx.practitionerAddress.deleteMany({ where: { practitionerId: pr.id } });
				await tx.practitionerContact.deleteMany({ where: { practitionerId: pr.id } });
				if (p.addresses.length) {
					await tx.practitionerAddress.createMany({
						data: p.addresses.map((a) => ({ ...a, practitionerId: pr.id })),
					});
				}
				if (p.contacts.length) {
					await tx.practitionerContact.createMany({
						data: p.contacts.map((c) => ({ ...c, practitionerId: pr.id })),
					});
				}
			});
		} catch (e) {
			if (e && e.code === 'P2002') {
				const target = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target || '');
				if (target.includes('policyNumber')) return badRequest(res, 'Policy number already exists');
				return badRequest(res, 'Unique field already exists');
			}
			throw e;
		}
		const full = await prisma.user.findUnique({
			where: { id },
			include: { practitioner: { include: { addresses: true, contacts: true } } },
		});
		return ok(res, {
			id: full.id,
			email: full.email,
			name: full.name,
			role: toApiRole(full.role),
			practitionerProfile: serializePractitionerProfile(full.practitioner),
		});
	}

	const user = await prisma.user.update({
		where: { id },
		data,
		include: { practitioner: { include: { addresses: true, contacts: true } } },
	});

	const out = {
		id: user.id,
		email: user.email,
		name: user.name,
		role: toApiRole(user.role),
	};
	if (user.role === 'PRACTITIONER' && user.practitioner) {
		out.practitionerProfile = serializePractitionerProfile(user.practitioner);
	}
	return ok(res, out);
});

module.exports = router;
