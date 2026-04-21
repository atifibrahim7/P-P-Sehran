const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { normalizeEmail } = require('../../lib/email');
const { sendPatientWelcomeEmail } = require('../../lib/mail/patientWelcome');

const router = Router();

function parsePatientsPage(query) {
	const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
	const rawLimit = Number.parseInt(query.limit, 10);
	const limit = Math.min(100, Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20));
	return { page, limit, skip: (page - 1) * limit };
}

router.get('/', authenticateToken, requireRole('practitioner'), async (req, res) => {
	const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
	if (!pr) return badRequest(res, 'Practitioner profile not found');

	const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
	const { page, limit, skip } = parsePatientsPage(req.query);

	const where = {
		practitionerId: pr.id,
		...(q
			? {
					user: {
						OR: [{ name: { contains: q } }, { email: { contains: q } }],
					},
				}
			: {}),
	};

	const [total, rows] = await Promise.all([
		prisma.patient.count({ where }),
		prisma.patient.findMany({
			where,
			include: {
				user: { select: { id: true, name: true, email: true } },
				practitioner: { include: { user: { select: { name: true } } } },
			},
			orderBy: { id: 'asc' },
			skip,
			take: limit,
		}),
	]);

	const items = rows.map((p) => ({
		patientId: p.id,
		userId: p.user.id,
		name: p.user.name,
		email: p.user.email,
		primaryPractitionerName: p.practitioner?.user?.name ?? null,
	}));

	return ok(res, { items, total, page, limit });
});

router.post('/', authenticateToken, requireRole('practitioner'), async (req, res) => {
	const pr = await prisma.practitioner.findUnique({
		where: { userId: Number(req.user.userId) },
		include: { user: { select: { name: true } } },
	});
	if (!pr) return badRequest(res, 'Practitioner profile not found');

	const { name, password } = req.body || {};
	const email = normalizeEmail(req.body?.email);
	if (!email || !name || typeof name !== 'string' || !name.trim()) {
		return badRequest(res, 'name and email required');
	}

	const trimmedName = name.trim();
	const rawPw = password != null ? String(password).trim() : '';
	const passwordPlain =
		rawPw.length > 0 ? rawPw : crypto.randomBytes(18).toString('base64url');

	if (passwordPlain.length < 8) {
		return badRequest(res, 'password must be at least 8 characters when provided');
	}

	const exists = await prisma.user.findUnique({ where: { email } });
	if (exists) return badRequest(res, 'Email already exists');

	const hash = bcrypt.hashSync(passwordPlain, 10);

	let userId;
	let patientId;
	try {
		await prisma.$transaction(async (tx) => {
			const u = await tx.user.create({
				data: { email, name: trimmedName, password: hash, role: 'PATIENT' },
			});
			const patient = await tx.patient.create({
				data: { userId: u.id, practitionerId: pr.id },
			});
			userId = u.id;
			patientId = patient.id;
		});
	} catch (e) {
		if (e && e.code === 'P2002') return badRequest(res, 'Email already exists');
		throw e;
	}

	let emailSent = false;
	try {
		await sendPatientWelcomeEmail({
			to: email,
			patientName: trimmedName,
			loginEmail: email,
			passwordPlain,
			practitionerName: pr.user.name,
		});
		emailSent = true;
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('[patients:create] welcome email failed', err);
	}

	return created(res, {
		userId,
		patientId,
		email,
		name: trimmedName,
		emailSent,
	});
});

module.exports = router;
