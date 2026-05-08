const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { normalizeEmail } = require('../../lib/email');
const { sendPatientWelcomeEmail } = require('../../lib/mail/patientWelcome');
const {
	GENDER_INPUT_TO_DB,
	SMOKER_INPUT_TO_DB,
	readTrimmedString,
	parseDateOnly,
	normalizeAddresses,
	normalizeContacts,
} = require('../../lib/personPayloadNormalize');

const router = Router();

function mapGenderToApi(gender) {
	if (gender === 'MALE') return 'Male';
	if (gender === 'FEMALE') return 'Female';
	return 'Unknown';
}

function mapSmokerToApi(smokerStatus) {
	if (smokerStatus === 'SMOKER') return 'Smoker';
	if (smokerStatus === 'NON_SMOKER') return 'NonSmoker';
	return 'Unknown';
}

function serializePatientDetail(patient) {
	return {
		patientId: patient.id,
		userId: patient.userId,
		name: patient.user?.name ?? '',
		email: patient.user?.email ?? '',
		title: patient.title ?? '',
		forenames: patient.forenames ?? '',
		surname: patient.surname ?? '',
		dateOfBirth:
			patient.dateOfBirth instanceof Date ? patient.dateOfBirth.toISOString().slice(0, 10) : patient.dateOfBirth,
		gender: mapGenderToApi(patient.gender),
		policyNumber: patient.policyNumber ?? '',
		clientReference2: patient.clientReference2 ?? null,
		nationalInsuranceNumber: patient.nationalInsuranceNumber ?? null,
		smokerStatus: mapSmokerToApi(patient.smokerStatus),
		primaryPractitionerName: patient.practitioner?.user?.name ?? null,
		addresses: (patient.addresses || []).map((address) => ({
			id: address.id,
			addressTypeId: address.addressTypeId,
			addressLine1: address.addressLine1,
			addressLine2: address.addressLine2,
			addressLine3: address.addressLine3,
			city: address.city,
			county: address.county,
			country: address.country,
			postcode: address.postcode,
			isPreferred: address.isPreferred,
		})),
		contacts: (patient.contacts || []).map((contact) => ({
			id: contact.id,
			phoneNumber: contact.phoneNumber,
			phoneType: contact.phoneType === 'HOME' ? 'Home' : contact.phoneType === 'WORK' ? 'Work' : contact.phoneType === 'OTHER' ? 'Other' : 'Mobile',
		})),
	};
}

async function assertPatientAccess(req, patient) {
	if (req.user.role === 'admin') return true;
	if (req.user.role !== 'practitioner') return false;
	const pr = await prisma.practitioner.findUnique({ where: { userId: Number(req.user.userId) } });
	if (!pr) return false;
	return patient.practitionerId === pr.id;
}

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
		deletedAt: null,
		practitionerId: pr.id,
		user: { deletedAt: null },
		...(q
			? {
					OR: [
						{ user: { name: { contains: q } } },
						{ user: { email: { contains: q } } },
						{ forenames: { contains: q } },
						{ surname: { contains: q } },
						{ policyNumber: { contains: q } },
					],
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
		forenames: p.forenames,
		surname: p.surname,
		policyNumber: p.policyNumber,
		primaryPractitionerName: p.practitioner?.user?.name ?? null,
	}));

	return ok(res, { items, total, page, limit });
});

router.get('/:userId', authenticateToken, requireRole('practitioner', 'admin'), async (req, res) => {
	const userId = Number(req.params.userId);
	if (Number.isNaN(userId)) return res.status(404).json({ success: false, error: { message: 'Patient not found' } });

	const patient = await prisma.patient.findFirst({
		where: {
			userId,
			deletedAt: null,
			user: { deletedAt: null, role: 'PATIENT' },
		},
		include: {
			user: { select: { id: true, name: true, email: true } },
			practitioner: { include: { user: { select: { name: true } } } },
			addresses: true,
			contacts: true,
		},
	});
	if (!patient) return res.status(404).json({ success: false, error: { message: 'Patient not found' } });

	if (req.user.role !== 'admin') {
		const allowed = await assertPatientAccess(req, patient);
		if (!allowed) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}

	return ok(res, serializePatientDetail(patient));
});

router.put('/:userId', authenticateToken, requireRole('practitioner', 'admin'), async (req, res) => {
	const userId = Number(req.params.userId);
	if (Number.isNaN(userId)) return res.status(404).json({ success: false, error: { message: 'Patient not found' } });

	const existing = await prisma.patient.findFirst({
		where: {
			userId,
			deletedAt: null,
			user: { deletedAt: null, role: 'PATIENT' },
		},
		include: {
			user: { select: { id: true, name: true, email: true } },
			practitioner: { include: { user: { select: { name: true } } } },
		},
	});
	if (!existing) return res.status(404).json({ success: false, error: { message: 'Patient not found' } });

	if (req.user.role !== 'admin') {
		const allowed = await assertPatientAccess(req, existing);
		if (!allowed) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}

	const email = normalizeEmail(req.body?.email);
	const password = req.body?.password != null ? String(req.body.password).trim() : '';
	const title = req.body?.title == null ? null : readTrimmedString(req.body?.title, 10);
	const forenames = readTrimmedString(req.body?.forenames, 100);
	const surname = readTrimmedString(req.body?.surname, 100);
	const dateOfBirth = parseDateOnly(req.body?.dateOfBirth);
	const gender = GENDER_INPUT_TO_DB[req.body?.gender];
	const policyNumber = readTrimmedString(req.body?.policyNumber, 100);
	const clientReference2 = req.body?.clientReference2 == null ? null : readTrimmedString(req.body?.clientReference2, 100);
	const nationalInsuranceNumber =
		req.body?.nationalInsuranceNumber == null ? null : readTrimmedString(req.body?.nationalInsuranceNumber, 50);
	const smokerStatus = req.body?.smokerStatus == null ? 'UNKNOWN' : SMOKER_INPUT_TO_DB[req.body?.smokerStatus];
	const addresses = normalizeAddresses(req.body?.addresses);
	const contacts = normalizeContacts(req.body?.contacts);

	if (!email || !forenames || !surname || !dateOfBirth || !gender || !policyNumber || !smokerStatus) {
		return badRequest(
			res,
			'email, forenames, surname, dateOfBirth (YYYY-MM-DD), gender, and policyNumber are required'
		);
	}
	if (req.body?.title != null && !title) {
		return badRequest(res, 'title must be a non-empty string up to 10 characters');
	}
	if (req.body?.clientReference2 != null && !clientReference2) {
		return badRequest(res, 'clientReference2 must be a non-empty string up to 100 characters');
	}
	if (req.body?.nationalInsuranceNumber != null && !nationalInsuranceNumber) {
		return badRequest(res, 'nationalInsuranceNumber must be a non-empty string up to 50 characters');
	}
	if (!addresses) {
		return badRequest(res, 'addresses must be an array with valid address fields and at most one preferred address');
	}
	if (!contacts) {
		return badRequest(res, 'contacts must be an array with valid phoneNumber and phoneType');
	}
	if (password && password.length < 8) {
		return badRequest(res, 'password must be at least 8 characters when provided');
	}

	const name = `${forenames} ${surname}`.replace(/\s+/g, ' ').trim();
	const existingEmail = await prisma.user.findFirst({ where: { email, deletedAt: null, NOT: { id: existing.userId } } });
	if (existingEmail) return badRequest(res, 'Email already exists');

	try {
		await prisma.$transaction(async (tx) => {
			if (password) {
				const hash = bcrypt.hashSync(password, 10);
				await tx.user.update({
					where: { id: existing.userId },
					data: { email, name, ...(password ? { password: hash } : {}) },
				});
			} else {
				await tx.user.update({
					where: { id: existing.userId },
					data: { email, name },
				});
			}
			await tx.patient.update({
				where: { id: existing.id },
				data: {
					title,
					forenames,
					surname,
					dateOfBirth,
					gender,
					policyNumber,
					clientReference2,
					nationalInsuranceNumber,
					smokerStatus,
				},
			});
			await tx.address.deleteMany({ where: { patientId: existing.id } });
			await tx.contact.deleteMany({ where: { patientId: existing.id } });
			if (addresses.length) {
				await tx.address.createMany({ data: addresses.map((address) => ({ ...address, patientId: existing.id })) });
			}
			if (contacts.length) {
				await tx.contact.createMany({ data: contacts.map((contact) => ({ ...contact, patientId: existing.id })) });
			}
		});
	} catch (e) {
		if (e && e.code === 'P2002') {
			const target = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target || '');
			if (target.includes('email')) return badRequest(res, 'Email already exists');
			if (target.includes('policyNumber')) return badRequest(res, 'Policy number already exists');
			return badRequest(res, 'Unique field already exists');
		}
		throw e;
	}

	const updated = await prisma.patient.findUnique({
		where: { id: existing.id },
		include: {
			user: { select: { id: true, name: true, email: true } },
			practitioner: { include: { user: { select: { name: true } } } },
			addresses: true,
			contacts: true,
		},
	});

	return ok(res, serializePatientDetail(updated));
});

router.delete('/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
	const userId = Number(req.params.userId);
	if (Number.isNaN(userId)) return res.status(404).json({ success: false, error: { message: 'Patient not found' } });

	const patient = await prisma.patient.findFirst({
		where: {
			userId,
			deletedAt: null,
			user: { deletedAt: null, role: 'PATIENT' },
		},
		include: { user: { select: { id: true } } },
	});
	if (!patient) return res.status(404).json({ success: false, error: { message: 'Patient not found' } });

	const deletedAt = new Date();
	await prisma.$transaction(async (tx) => {
		await tx.patient.update({
			where: { id: patient.id },
			data: { deletedAt },
		});
		await tx.user.update({
			where: { id: patient.user.id },
			data: { deletedAt },
		});
	});

	return ok(res, { userId: patient.user.id, patientId: patient.id, deletedAt: deletedAt.toISOString() });
});

router.post('/', authenticateToken, requireRole('practitioner'), async (req, res) => {
	const pr = await prisma.practitioner.findUnique({
		where: { userId: Number(req.user.userId) },
		include: { user: { select: { name: true } } },
	});
	if (!pr) return badRequest(res, 'Practitioner profile not found');

	const { password } = req.body || {};
	const email = normalizeEmail(req.body?.email);
	const title = req.body?.title == null ? null : readTrimmedString(req.body?.title, 10);
	const forenames = readTrimmedString(req.body?.forenames, 100);
	const surname = readTrimmedString(req.body?.surname, 100);
	const dateOfBirth = parseDateOnly(req.body?.dateOfBirth);
	const gender = GENDER_INPUT_TO_DB[req.body?.gender];
	const policyNumber = readTrimmedString(req.body?.policyNumber, 100);
	const clientReference2 = req.body?.clientReference2 == null ? null : readTrimmedString(req.body?.clientReference2, 100);
	const nationalInsuranceNumber =
		req.body?.nationalInsuranceNumber == null ? null : readTrimmedString(req.body?.nationalInsuranceNumber, 50);
	const smokerStatus = req.body?.smokerStatus == null ? 'UNKNOWN' : SMOKER_INPUT_TO_DB[req.body?.smokerStatus];
	const addresses = normalizeAddresses(req.body?.addresses);
	const contacts = normalizeContacts(req.body?.contacts);

	if (!email || !forenames || !surname || !dateOfBirth || !gender || !policyNumber || !smokerStatus) {
		return badRequest(
			res,
			'email, forenames, surname, dateOfBirth (YYYY-MM-DD), gender, and policyNumber are required'
		);
	}
	if (req.body?.title != null && !title) {
		return badRequest(res, 'title must be a non-empty string up to 10 characters');
	}
	if (req.body?.clientReference2 != null && !clientReference2) {
		return badRequest(res, 'clientReference2 must be a non-empty string up to 100 characters');
	}
	if (req.body?.nationalInsuranceNumber != null && !nationalInsuranceNumber) {
		return badRequest(res, 'nationalInsuranceNumber must be a non-empty string up to 50 characters');
	}
	if (!addresses) {
		return badRequest(res, 'addresses must be an array with valid address fields and at most one preferred address');
	}
	if (!contacts) {
		return badRequest(res, 'contacts must be an array with valid phoneNumber and phoneType');
	}

	const name = `${forenames} ${surname}`.replace(/\s+/g, ' ').trim();
	const rawPw = password != null ? String(password).trim() : '';
	const passwordPlain =
		rawPw.length > 0 ? rawPw : crypto.randomBytes(18).toString('base64url');

	if (passwordPlain.length < 8) {
		return badRequest(res, 'password must be at least 8 characters when provided');
	}

	const exists = await prisma.user.findFirst({ where: { email, deletedAt: null } });
	if (exists) return badRequest(res, 'Email already exists');

	const hash = bcrypt.hashSync(passwordPlain, 10);

	let userId;
	let patientId;
	try {
		await prisma.$transaction(async (tx) => {
			const u = await tx.user.create({
				data: { email, name, password: hash, role: 'PATIENT' },
			});
			const patient = await tx.patient.create({
				data: {
					userId: u.id,
					practitionerId: pr.id,
					title,
					forenames,
					surname,
					dateOfBirth,
					gender,
					policyNumber,
					clientReference2,
					nationalInsuranceNumber,
					smokerStatus,
				},
			});
			if (addresses.length) {
				await tx.address.createMany({
					data: addresses.map((address) => ({ ...address, patientId: patient.id })),
				});
			}
			if (contacts.length) {
				await tx.contact.createMany({
					data: contacts.map((contact) => ({ ...contact, patientId: patient.id })),
				});
			}
			userId = u.id;
			patientId = patient.id;
		});
	} catch (e) {
		if (e && e.code === 'P2002') {
			const target = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target || '');
			if (target.includes('email')) return badRequest(res, 'Email already exists');
			if (target.includes('policyNumber')) return badRequest(res, 'Policy number already exists');
			return badRequest(res, 'Unique field already exists');
		}
		throw e;
	}

	let emailSent = false;
	try {
		await sendPatientWelcomeEmail({
			to: email,
			patientName: name,
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
		name,
		forenames,
		surname,
		policyNumber,
		emailSent,
	});
});

module.exports = router;
