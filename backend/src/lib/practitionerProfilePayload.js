const {
	GENDER_INPUT_TO_DB,
	SMOKER_INPUT_TO_DB,
	readTrimmedString,
	parseDateOnly,
	normalizeAddresses,
	normalizeContacts,
} = require('./personPayloadNormalize');

/**
 * @param {object} raw from req.body.practitionerProfile
 * @returns {{ ok: true, data: object } | { ok: false, message: string }}
 */
function parsePractitionerProfilePayload(raw) {
	if (!raw || typeof raw !== 'object') {
		return { ok: false, message: 'practitionerProfile object is required for practitioner users' };
	}
	const title = raw.title == null ? null : readTrimmedString(raw.title, 10);
	const forenames = readTrimmedString(raw.forenames, 100);
	const surname = readTrimmedString(raw.surname, 100);
	const dateOfBirth = parseDateOnly(raw.dateOfBirth);
	const gender = GENDER_INPUT_TO_DB[raw.gender];
	const policyNumber = readTrimmedString(raw.policyNumber, 100);
	const clientReference2 = raw.clientReference2 == null ? null : readTrimmedString(raw.clientReference2, 100);
	const nationalInsuranceNumber =
		raw.nationalInsuranceNumber == null ? null : readTrimmedString(raw.nationalInsuranceNumber, 50);
	const smokerStatus = raw.smokerStatus == null ? 'UNKNOWN' : SMOKER_INPUT_TO_DB[raw.smokerStatus];
	const addresses = normalizeAddresses(raw.addresses);
	const contacts = normalizeContacts(raw.contacts);

	if (!forenames || !surname || !dateOfBirth || !gender || !policyNumber || !smokerStatus) {
		return {
			ok: false,
			message:
				'practitionerProfile: forenames, surname, dateOfBirth (YYYY-MM-DD), gender, policyNumber, smokerStatus are required',
		};
	}
	if (raw.title != null && !title) {
		return { ok: false, message: 'practitionerProfile.title must be a non-empty string up to 10 characters' };
	}
	if (raw.clientReference2 != null && !clientReference2) {
		return { ok: false, message: 'practitionerProfile.clientReference2 must be a non-empty string up to 100 characters' };
	}
	if (raw.nationalInsuranceNumber != null && !nationalInsuranceNumber) {
		return {
			ok: false,
			message: 'practitionerProfile.nationalInsuranceNumber must be a non-empty string up to 50 characters',
		};
	}
	if (!addresses) {
		return {
			ok: false,
			message:
				'practitionerProfile.addresses must be an array with valid address fields and at most one preferred address',
		};
	}
	if (!contacts) {
		return { ok: false, message: 'practitionerProfile.contacts must be an array with valid phoneNumber and phoneType' };
	}
	if (!addresses.length) {
		return { ok: false, message: 'practitionerProfile.addresses must contain at least one address' };
	}
	if (!contacts.length) {
		return { ok: false, message: 'practitionerProfile.contacts must contain at least one contact' };
	}

	return {
		ok: true,
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
			addresses,
			contacts,
		},
	};
}

function serializePractitionerProfile(pr) {
	if (!pr) return null;
	return {
		title: pr.title,
		forenames: pr.forenames,
		surname: pr.surname,
		dateOfBirth: pr.dateOfBirth instanceof Date ? pr.dateOfBirth.toISOString().slice(0, 10) : pr.dateOfBirth,
		gender: pr.gender,
		policyNumber: pr.policyNumber,
		clientReference2: pr.clientReference2,
		nationalInsuranceNumber: pr.nationalInsuranceNumber,
		smokerStatus: pr.smokerStatus,
		addresses: (pr.addresses || []).map((a) => ({
			id: a.id,
			addressTypeId: a.addressTypeId,
			addressLine1: a.addressLine1,
			addressLine2: a.addressLine2,
			addressLine3: a.addressLine3,
			city: a.city,
			county: a.county,
			country: a.country,
			postcode: a.postcode,
			isPreferred: a.isPreferred,
		})),
		contacts: (pr.contacts || []).map((c) => ({
			id: c.id,
			phoneNumber: c.phoneNumber,
			phoneType: c.phoneType,
		})),
	};
}

module.exports = {
	parsePractitionerProfilePayload,
	serializePractitionerProfile,
};
