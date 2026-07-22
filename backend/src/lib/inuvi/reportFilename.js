/**
 * Agreed naming convention for report files uploaded by the external lab system:
 *   {ClinicName}.{InuviReference}.{PolicyNumber}.{FirstName}.{LastName}.{Timestamp}.{ext}
 * e.g. "The National Blood Test Clinic.0000652404-1.1234543456342.Atif Ibrahim.Abbasi.20260615110000.pdf"
 *
 * ClinicName may itself contain dots, so the last 5 dot-separated segments (before the extension)
 * are taken as [inuviReference, policyNumber, firstName, lastName, timestamp] and whatever remains
 * is the clinic name.
 */

/** @param {string} originalNameWithoutExt filename with the extension already stripped */
function parseInuviReportFilename(originalNameWithoutExt) {
	const parts = String(originalNameWithoutExt || '').split('.');
	if (parts.length < 5) return null;

	const [inuviReference, policyNumber, firstName, lastName, timestamp] = parts.slice(-5);
	const clinicName = parts.slice(0, -5).join('.').trim();

	if (!policyNumber?.trim() || !lastName?.trim()) return null;

	return {
		clinicName,
		inuviReference: inuviReference.trim(),
		policyNumber: policyNumber.trim(),
		firstName: firstName.trim(),
		lastName: lastName.trim(),
		timestamp: timestamp.trim(),
	};
}

module.exports = { parseInuviReportFilename };
