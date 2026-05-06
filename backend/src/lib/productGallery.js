/**
 * Ordered gallery for UI: primary `imageUrl` then extra `ProductImage` rows (no duplicate URLs).
 */
function orderedGalleryUrls(product) {
	const primary = product?.imageUrl || null;
	const extras = [...(product?.productImages || [])]
		.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
		.map((i) => i.url)
		.filter(Boolean);
	const seen = new Set();
	const out = [];
	for (const u of [primary, ...extras]) {
		if (!u || seen.has(u)) continue;
		seen.add(u);
		out.push(u);
	}
	return out;
}

module.exports = { orderedGalleryUrls };
