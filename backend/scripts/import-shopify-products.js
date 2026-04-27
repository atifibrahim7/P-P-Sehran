/**
 * Import Shopify products CSV into Product rows + optional Cloudinary image upload.
 *
 * Usage:
 *   node scripts/import-shopify-products.js --file="/path/to/export.csv" [--dry-run] [--category=supplement|lab_test] [--limit=N] [--include-inactive]
 *
 * Env: DATABASE_URL, CLOUDINARY_* (for images; skipped in --dry-run or if missing)
 *
 * Pricing: patientPrice = Shopify Variant Price; practitionerPrice = 10% below that (×0.9, 2 dp).
 *
 * Gallery: rows with same Handle are merged; extra Shopify rows (often empty except Image Src)
 * add more images → ProductImage + swipe catalog in API (`imageUrls`).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const cloudinary = require('cloudinary').v2;

const { loadEnv } = require('../src/config/env');
loadEnv();

const prisma = require('../src/config/prisma');
const { normalizeShopifySku } = require('../src/lib/shopifyImport');

const DESC_MAX = 190;

function parseArgs(argv) {
	const out = {
		file: null,
		dryRun: false,
		category: 'supplement',
		limit: null,
		skipInactive: true,
	};
	for (const a of argv) {
		if (a === '--dry-run') out.dryRun = true;
		else if (a === '--include-inactive') out.skipInactive = false;
		else if (a.startsWith('--file=')) out.file = a.slice('--file='.length);
		else if (a.startsWith('--category=')) out.category = a.slice('--category='.length).toLowerCase();
		else if (a.startsWith('--limit=')) out.limit = Math.max(1, Number.parseInt(a.slice('--limit='.length), 10) || 0);
		else if (!a.startsWith('--') && a.endsWith('.csv')) out.file = a;
	}
	return out;
}

function truncateDescription(html) {
	if (html == null || String(html).trim() === '') return null;
	const text = String(html)
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= DESC_MAX) return text;
	return `${text.slice(0, DESC_MAX - 3)}...`;
}

function parsePrice(v) {
	if (v == null || String(v).trim() === '') return null;
	const n = Number(String(v).replace(/[$£€,\s]/g, '').trim());
	if (Number.isNaN(n) || n < 0) return null;
	return n;
}

/** Practitioner pays 10% less than patient-facing Shopify price. */
function practitionerPriceFromPatient(patientPrice) {
	return Math.round(Number(patientPrice) * 0.9 * 100) / 100;
}

function pickImageUrlsFromRow(row) {
	const out = [];
	const seen = new Set();
	for (const k of ['Image Src', 'Variant Image']) {
		const u = (row[k] || '').trim();
		if (u && !seen.has(u)) {
			seen.add(u);
			out.push(u);
		}
	}
	return out;
}

function rowContributesImages(row, skipInactive) {
	if (!skipInactive) return true;
	const s = String(row.Status || row.status || '').trim().toLowerCase();
	if (!s || s === 'active') return true;
	return false;
}

function collectOrderedImageUrlsFromRows(rows, skipInactive) {
	const seen = new Set();
	const urls = [];
	for (const row of rows) {
		if (!rowContributesImages(row, skipInactive)) continue;
		for (const u of pickImageUrlsFromRow(row)) {
			if (!seen.has(u)) {
				seen.add(u);
				urls.push(u);
			}
		}
	}
	return urls;
}

function groupRowsByHandleInOrder(records) {
	const order = [];
	const map = new Map();
	for (const row of records) {
		const h = (row.Handle || '').trim();
		if (!h) continue;
		if (!map.has(h)) {
			map.set(h, []);
			order.push(h);
		}
		map.get(h).push(row);
	}
	return order.map((handle) => ({ handle, rows: map.get(handle) }));
}

function findAnchorRow(rows, skipInactive) {
	for (const row of rows) {
		if (!rowStatusActive(row, skipInactive)) continue;
		const title = (row.Title || '').trim();
		const price = parsePrice(row['Variant Price']);
		if (title && price != null) return row;
	}
	return null;
}

async function syncProductGallery(productId, uploadedUrls, dryRun) {
	if (dryRun) return;
	await prisma.productImage.deleteMany({ where: { productId } });
	const rest = uploadedUrls.slice(1);
	if (!rest.length) return;
	await prisma.productImage.createMany({
		data: rest.map((url, sortOrder) => ({ productId, url, sortOrder })),
	});
}

function categoryToDb(cat) {
	if (cat === 'lab_test') return 'BLOOD_TEST';
	return 'SUPPLEMENT';
}

function vendorTypesForCategory(dbCat) {
	if (dbCat === 'SUPPLEMENT') return ['SUPPLEMENT', 'BOTH'];
	return ['LAB', 'BOTH'];
}

async function findVendorIdCaseInsensitive(name) {
	const key = String(name || '').trim();
	if (!key) return null;
	const rows = await prisma.$queryRaw`
		SELECT id FROM Vendor WHERE LOWER(TRIM(name)) = LOWER(${key}) LIMIT 1
	`;
	return rows[0]?.id ?? null;
}

async function defaultVendorId(dbCategory) {
	const types = vendorTypesForCategory(dbCategory);
	const v = await prisma.vendor.findFirst({
		where: { OR: types.map((t) => ({ type: t })) },
		orderBy: { id: 'asc' },
	});
	return v?.id ?? null;
}

async function vendorSuppliesCategory(vendorId, dbCategory) {
	const v = await prisma.vendor.findUnique({ where: { id: vendorId } });
	if (!v) return false;
	if (dbCategory === 'SUPPLEMENT') return v.type === 'SUPPLEMENT' || v.type === 'BOTH';
	if (dbCategory === 'BLOOD_TEST') return v.type === 'LAB' || v.type === 'BOTH';
	return false;
}

async function resolveVendorId(vendorName, dbCategory, dryRun) {
	const key = String(vendorName || '').trim();
	if (key) {
		const existing = await findVendorIdCaseInsensitive(key);
		if (existing && (await vendorSuppliesCategory(existing, dbCategory))) return existing;
		if (existing) {
			const def = await defaultVendorId(dbCategory);
			if (def) return def;
		}
		if (dryRun) return defaultVendorId(dbCategory);
		const type = dbCategory === 'SUPPLEMENT' ? 'SUPPLEMENT' : 'LAB';
		const created = await prisma.vendor.create({
			data: { name: key, type },
		});
		return created.id;
	}
	return defaultVendorId(dbCategory);
}

function configureCloudinary() {
	const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
	if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false;
	cloudinary.config({
		cloud_name: CLOUDINARY_CLOUD_NAME,
		api_key: CLOUDINARY_API_KEY,
		api_secret: CLOUDINARY_API_SECRET,
	});
	return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uploadImageFromUrl(remoteUrl, imageCache, dryRun) {
	if (!remoteUrl) return null;
	if (imageCache.has(remoteUrl)) return imageCache.get(remoteUrl);
	if (dryRun || !configureCloudinary()) {
		imageCache.set(remoteUrl, remoteUrl);
		return remoteUrl;
	}
	let lastErr;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const folder = process.env.CLOUDINARY_FOLDER || 'healthcare-products';
			const res = await cloudinary.uploader.upload(remoteUrl, {
				folder,
				resource_type: 'image',
				overwrite: false,
			});
			const url = res.secure_url || res.url;
			imageCache.set(remoteUrl, url);
			await sleep(250);
			return url;
		} catch (e) {
			lastErr = e;
			await sleep(1000 * attempt);
		}
	}
	throw lastErr;
}

function rowStatusActive(row, skipInactive) {
	if (!skipInactive) return true;
	const s = String(row.Status || row.status || 'active').trim().toLowerCase();
	return s === 'active' || s === '';
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.file || !fs.existsSync(args.file)) {
		console.error('Usage: node scripts/import-shopify-products.js --file="/path/to/products.csv" [--dry-run] [--category=supplement|lab_test] [--limit=N] [--include-inactive]');
		process.exit(1);
	}
	const dbCategory = categoryToDb(args.category);
	const csvText = fs.readFileSync(path.resolve(args.file), 'utf8');
	const records = parse(csvText, {
		columns: true,
		skip_empty_lines: true,
		relax_column_count: true,
		trim: true,
		bom: true,
	});

	const usedSkus = new Set();
	const existingProducts = await prisma.product.findMany({
		where: { labTestCode: { not: null } },
		select: { labTestCode: true },
	});
	for (const p of existingProducts) {
		if (p.labTestCode) usedSkus.add(p.labTestCode);
	}

	const imageCache = new Map();
	let applied = 0;
	let skipped = 0;
	const errors = [];

	const handleGroups = groupRowsByHandleInOrder(records);
	for (const { handle, rows } of handleGroups) {
		if (args.limit != null && applied >= args.limit) break;

		const anchor = findAnchorRow(rows, args.skipInactive);
		if (!anchor) {
			skipped += rows.length;
			continue;
		}

		const title = (anchor.Title || '').trim();
		const price = parsePrice(anchor['Variant Price']);
		if (price == null) {
			skipped += rows.length;
			errors.push({ handle, reason: 'invalid_or_missing_price' });
			continue;
		}
		const sku = normalizeShopifySku(anchor['Variant SKU'], handle || title, usedSkus);
		if (!sku) {
			skipped += rows.length;
			errors.push({ handle, reason: 'could_not_build_sku' });
			continue;
		}

		let vendorId;
		try {
			vendorId = await resolveVendorId(anchor.Vendor, dbCategory, args.dryRun);
		} catch (e) {
			skipped += rows.length;
			errors.push({ handle, sku, reason: 'vendor_error', message: e.message });
			continue;
		}
		if (!vendorId) {
			skipped += rows.length;
			errors.push({ handle, sku, reason: 'no_vendor' });
			continue;
		}

		const description = truncateDescription(anchor['Body (HTML)']);
		const rawImageUrls = collectOrderedImageUrlsFromRows(rows, args.skipInactive);
		const uploadedUrls = [];
		for (const remote of rawImageUrls) {
			try {
				uploadedUrls.push(await uploadImageFromUrl(remote, imageCache, args.dryRun));
			} catch (e) {
				errors.push({ handle, sku, reason: 'cloudinary_failed', message: e.message, remote });
				uploadedUrls.push(remote);
			}
		}
		const imageUrl = uploadedUrls[0] ?? null;

		const patientPrice = price;
		const practitionerPrice = practitionerPriceFromPatient(patientPrice);
		const data = {
			name: title.slice(0, 191),
			description,
			category: dbCategory,
			vendorId,
			patientPrice,
			practitionerPrice,
			labTestCode: sku,
			imageUrl,
			shopifyHandle: handle || null,
			shopifyProductId: null,
			shopifyVariantId: null,
		};

		if (args.dryRun) {
			const existing = await prisma.product.findFirst({ where: { labTestCode: sku } });
			console.log(
				JSON.stringify({
					action: existing ? 'update' : 'create',
					sku,
					handle,
					name: data.name,
					patientPrice,
					practitionerPrice,
					vendorId,
					imageCount: uploadedUrls.length,
					primaryImage: imageUrl ? 'set' : 'none',
				})
			);
			applied += 1;
			continue;
		}

		const existing = await prisma.product.findFirst({ where: { labTestCode: sku } });
		let productId;
		if (existing) {
			await prisma.product.update({
				where: { id: existing.id },
				data: {
					name: data.name,
					description: data.description,
					category: data.category,
					vendorId: data.vendorId,
					patientPrice: data.patientPrice,
					practitionerPrice: data.practitionerPrice,
					imageUrl: imageUrl ?? existing.imageUrl,
					shopifyHandle: data.shopifyHandle,
				},
			});
			productId = existing.id;
		} else {
			const created = await prisma.product.create({ data });
			productId = created.id;
		}
		await syncProductGallery(productId, uploadedUrls, args.dryRun);
		applied += 1;
	}

	console.log(
		JSON.stringify(
			{
				file: args.file,
				dryRun: args.dryRun,
				category: args.category,
				dbCategory,
				applied,
				skipped,
				errors: errors.slice(0, 50),
				errorTruncated: errors.length > 50,
			},
			null,
			2
		)
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
