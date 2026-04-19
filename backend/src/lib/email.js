/** Normalize email for lookup/storage (trim + lowercase). */
function normalizeEmail(email) {
	if (email == null || typeof email !== 'string') return '';
	return email.trim().toLowerCase();
}

module.exports = { normalizeEmail };
