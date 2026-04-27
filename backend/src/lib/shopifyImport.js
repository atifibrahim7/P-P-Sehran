/**
 * Shopify CSV → Product.labTestCode (SKU) rules: match API normalizeSku in products/routes.js.
 * Allowed: A–Z, 0–9, dot, underscore, hyphen; max 64 chars.
 */

const MAX_LEN = 64;

function stripToAllowedUpper(raw) {
	const s = String(raw || '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9._-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '');
	return s.slice(0, MAX_LEN);
}

function isValidSku(s) {
	return Boolean(s && /^[A-Z0-9._-]+$/.test(s) && s.length <= MAX_LEN);
}

/**
 * @param {string} variantSku
 * @param {string} handle
 * @param {Set<string>} usedSkus mutates on success
 * @returns {string|null} null if no usable base
 */
function normalizeShopifySku(variantSku, handle, usedSkus) {
	let base = stripToAllowedUpper(variantSku);
	if (!isValidSku(base)) {
		base = stripToAllowedUpper(handle.replace(/\//g, '-'));
	}
	if (!isValidSku(base)) return null;

	let candidate = base;
	let n = 2;
	while (usedSkus.has(candidate)) {
		const suffix = `-${n}`;
		const cut = MAX_LEN - suffix.length;
		candidate = (base.length > cut ? base.slice(0, Math.max(1, cut)) : base) + suffix;
		n += 1;
		if (n > 9999) return null;
	}
	usedSkus.add(candidate);
	return candidate;
}

module.exports = { normalizeShopifySku, stripToAllowedUpper, isValidSku, MAX_LEN };
