/**
 * @param {unknown} value
 * @param {number | null} defaultIfEmpty when value is undefined/null/'' use this (must be integer ≥1)
 * @returns {number}
 */
function parsePositiveInt(value, defaultIfEmpty = null) {
	if (value === undefined || value === null || value === '') {
		if (defaultIfEmpty != null && Number.isInteger(defaultIfEmpty) && defaultIfEmpty >= 1) {
			return defaultIfEmpty;
		}
		throw Object.assign(new Error('Quantity required'), { status: 400 });
	}
	const n = Number(value);
	if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
		throw Object.assign(new Error('Quantity must be a whole number at least 1'), { status: 400 });
	}
	return n;
}

module.exports = { parsePositiveInt };
