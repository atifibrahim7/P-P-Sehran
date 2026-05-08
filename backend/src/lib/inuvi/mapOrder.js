/** Map Prisma enums / DB values to Inuvi JSON strings (camelCase DTO). */

function mapGenderToInuvi(dbGender) {
	const g = String(dbGender || 'UNKNOWN').toUpperCase();
	if (g === 'MALE') return 'Male';
	if (g === 'FEMALE') return 'Female';
	return 'Unknown';
}

function mapSmokerToInuvi(dbSmoker) {
	const s = String(dbSmoker || 'UNKNOWN').toUpperCase();
	if (s === 'SMOKER') return 'Smoker';
	if (s === 'NON_SMOKER') return 'NonSmoker';
	return 'Unknown';
}

function formatDateOfBirth(d) {
	if (!d) return null;
	const date = d instanceof Date ? d : new Date(d);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

function mapAddressesToInuvi(addresses) {
	if (!Array.isArray(addresses)) return [];
	return addresses.map((a) => ({
		AddressTypeId: a.addressTypeId,
		AddressLine1: a.addressLine1,
		...(a.addressLine2 ? { AddressLine2: a.addressLine2 } : {}),
		...(a.addressLine3 ? { AddressLine3: a.addressLine3 } : {}),
		City: a.city,
		...(a.county ? { County: a.county } : {}),
		Country: a.country,
		PostCode: a.postcode,
		IsPreferred: Boolean(a.isPreferred),
	}));
}

/** @param {{ phoneType: string, phoneNumber: string }[]} contacts */
function mapContactsToApplicantPhones(contacts) {
	const out = {};
	if (!Array.isArray(contacts)) return out;
	for (const c of contacts) {
		const t = String(c.phoneType || '').toUpperCase();
		if (t === 'MOBILE' && out.mobilePhone == null) out.mobilePhone = c.phoneNumber;
		else if (t === 'HOME' && out.homePhone == null) out.homePhone = c.phoneNumber;
		else if (t === 'WORK' && out.workPhone == null) out.workPhone = c.phoneNumber;
		else if (t === 'OTHER' && out.otherPhone == null) out.otherPhone = c.phoneNumber;
	}
	return out;
}

/**
 * @param {{ title?: string|null, forenames: string, surname: string, dateOfBirth: Date|string, gender: string, smokerStatus: string, nationalInsuranceNumber?: string|null }} profile
 * @param addresses from Prisma Address or PractitionerAddress
 * @param contacts from Prisma Contact or PractitionerContact
 */
function buildApplicantPayload(profile, addresses, contacts) {
	const phones = mapContactsToApplicantPhones(contacts);
	const applicant = {
		Title: (profile.title && String(profile.title).trim()) || 'Mr',
		FirstName: String(profile.forenames || '').trim(),
		LastName: String(profile.surname || '').trim(),
		Gender: mapGenderToInuvi(profile.gender),
		DateOfBirth: formatDateOfBirth(profile.dateOfBirth),
		SmokerStatus: mapSmokerToInuvi(profile.smokerStatus),
		Addresses: mapAddressesToInuvi(addresses),
	};
	if (phones.mobilePhone) applicant.MobilePhone = phones.mobilePhone;
	if (phones.homePhone) applicant.HomePhone = phones.homePhone;
	if (phones.workPhone) applicant.WorkPhone = phones.workPhone;
	if (phones.otherPhone) applicant.OtherPhone = phones.otherPhone;
	if (profile.nationalInsuranceNumber && String(profile.nationalInsuranceNumber).trim()) {
		applicant.NationalInsuranceNumber = String(profile.nationalInsuranceNumber).trim();
	}
	return applicant;
}

function validateApplicantPrerequisites({ forenames, surname, dateOfBirth, policyNumber }, addresses, contacts) {
	const errs = [];
	if (!forenames || !String(forenames).trim()) errs.push('forenames');
	if (!surname || !String(surname).trim()) errs.push('surname');
	if (!dateOfBirth) errs.push('dateOfBirth');
	if (!policyNumber || !String(policyNumber).trim()) errs.push('policyNumber');
	if (!addresses || addresses.length === 0) errs.push('at least one address');
	if (!contacts || contacts.length === 0) errs.push('at least one phone contact');
	const phones = mapContactsToApplicantPhones(contacts);
	if (!phones.mobilePhone && !phones.homePhone && !phones.workPhone && !phones.otherPhone) {
		errs.push('a contact with phoneType Mobile, Home, Work, or Other');
	}
	if (!addresses || !addresses.every((a) => a.addressLine1 && a.city && a.country && a.postcode)) {
		errs.push('each address needs addressLine1, city, country, postcode');
	}
	return errs.length ? `Missing Inuvi applicant data: ${errs.join(', ')}` : null;
}

/**
 * @param {object} order Prisma order with patient or practitioner + addresses + contacts + items.product
 * @returns {{ body: object, policyNumber: string } | { error: string }}
 */
function buildCreateOrderRequest(order) {
	if (order.type === 'PATIENT') {
		const p = order.patient;
		if (!p) return { error: 'Patient profile missing for Inuvi order' };
		const msg = validateApplicantPrerequisites(
			{
				forenames: p.forenames,
				surname: p.surname,
				dateOfBirth: p.dateOfBirth,
				policyNumber: p.policyNumber,
			},
			p.addresses,
			p.contacts,
		);
		if (msg) return { error: msg };
		const applicant = buildApplicantPayload(p, p.addresses, p.contacts);
		const body = {
			PolicyNumber: String(p.policyNumber).trim(),
			Applicant: applicant,
		};
			// Also include ClientRef (client reference 1) for Inuvi variants that expect it
			body.ClientRef = body.PolicyNumber;
		if (p.clientReference2 && String(p.clientReference2).trim()) {
			body.ClientReference2 = String(p.clientReference2).trim();
		}
		return { body, policyNumber: body.PolicyNumber };
	}
	if (order.type === 'SELF') {
		const pr = order.practitioner;
		if (!pr) return { error: 'Practitioner profile missing for Inuvi self-order' };
		const msg = validateApplicantPrerequisites(
			{
				forenames: pr.forenames,
				surname: pr.surname,
				dateOfBirth: pr.dateOfBirth,
				policyNumber: pr.policyNumber,
			},
			pr.addresses,
			pr.contacts,
		);
		if (msg) return { error: msg };
		const applicant = buildApplicantPayload(pr, pr.addresses, pr.contacts);
		const body = {
			PolicyNumber: String(pr.policyNumber).trim(),
			Applicant: applicant,
		};
			// Also include ClientRef (client reference 1) for Inuvi variants that expect it
			body.ClientRef = body.PolicyNumber;
		if (pr.clientReference2 && String(pr.clientReference2).trim()) {
			body.ClientReference2 = String(pr.clientReference2).trim();
		}
		return { body, policyNumber: body.PolicyNumber };
	}
	return { error: 'Unsupported order type for Inuvi' };
}

function buildCreateOrderExamRequest(product, examTypeId) {
	const body = { ExamType: examTypeId };
	if (product.labTestCode && String(product.labTestCode).trim()) {
		body.Requirements = [{ Code: String(product.labTestCode).trim() }];
	}
	return body;
}

module.exports = {
	mapGenderToInuvi,
	mapSmokerToInuvi,
	formatDateOfBirth,
	mapAddressesToInuvi,
	mapContactsToApplicantPhones,
	buildApplicantPayload,
	validateApplicantPrerequisites,
	buildCreateOrderRequest,
	buildCreateOrderExamRequest,
};
