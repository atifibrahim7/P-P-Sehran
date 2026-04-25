const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { normalizeEmail } = require('../../lib/email');
const { sendPatientWelcomeEmail } = require('../../lib/mail/patientWelcome');

const router = Router();

const GENDER_INPUT_TO_DB = {
	Unknown: 'UNKNOWN',
	Male: 'MALE',
	Female: 'FEMALE',
};

const SMOKER_INPUT_TO_DB = {
	Unknown: 'UNKNOWN',
	NonSmoker: 'NON_SMOKER',
	Smoker: 'SMOKER',
};

const PHONE_INPUT_TO_DB = {
	Mobile: 'MOBILE',
	Home: 'HOME',
	Work: 'WORK',
	Other: 'OTHER',
};

function readTrimmedString(value, maxLen) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > maxLen) return null;
	return trimmed;
}

function parseDateOnly(value) {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
	const parsed = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) return null;
	if (parsed.toISOString().slice(0, 10) !== text) return null;
	return parsed;
}

function normalizeAddresses(rawAddresses) {
	if (rawAddresses == null) return [];
	if (!Array.isArray(rawAddresses)) return null;

	const normalized = [];
	let preferredCount = 0;

	for (const address of rawAddresses) {
		if (!address || typeof address !== 'object') return null;
		const addressTypeId = Number.parseInt(address.addressTypeId, 10);
		if (![0, 1, 2].includes(addressTypeId)) return null;
		const addressLine1 = readTrimmedString(address.addressLine1, 255);
		const city = readTrimmedString(address.city, 100);
		const country = readTrimmedString(address.country, 100);
		const postcode = readTrimmedString(address.postcode, 20);
		if (!addressLine1 || !city || !country || !postcode) return null;

		const addressLine2 = address.addressLine2 == null ? null : readTrimmedString(address.addressLine2, 255);
		const addressLine3 = address.addressLine3 == null ? null : readTrimmedString(address.addressLine3, 255);
		const county = address.county == null ? null : readTrimmedString(address.county, 100);
		if ((address.addressLine2 != null && !addressLine2) || (address.addressLine3 != null && !addressLine3) || (address.county != null && !county)) {
			return null;
		}

		const isPreferred = Boolean(address.isPreferred);
		if (isPreferred) preferredCount += 1;

		normalized.push({
			addressTypeId,
			addressLine1,
			addressLine2,
			addressLine3,
			city,
			county,
			country,
			postcode,
			isPreferred,
		});
	}

	if (preferredCount > 1) return null;
	return normalized;
}

function normalizeContacts(rawContacts) {
	if (rawContacts == null) return [];
	if (!Array.isArray(rawContacts)) return null;

	const normalized = [];
	for (const contact of rawContacts) {
		if (!contact || typeof contact !== 'object') return null;
		const phoneNumber = readTrimmedString(contact.phoneNumber, 20);
		const phoneType = PHONE_INPUT_TO_DB[contact.phoneType];
		if (!phoneNumber || !phoneType) return null;
		normalized.push({ phoneNumber, phoneType });
	}
	return normalized;
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
		practitionerId: pr.id,
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

	const exists = await prisma.user.findUnique({ where: { email } });
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
