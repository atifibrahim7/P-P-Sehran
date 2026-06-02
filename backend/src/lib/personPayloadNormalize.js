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

module.exports = {
	GENDER_INPUT_TO_DB,
	SMOKER_INPUT_TO_DB,
	PHONE_INPUT_TO_DB,
	readTrimmedString,
	parseDateOnly,
	normalizeAddresses,
	normalizeContacts,
};
