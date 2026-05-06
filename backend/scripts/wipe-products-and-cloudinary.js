/**
 * Removes all products (cart lines + gallery cascade), all order line items, and
 * Cloudinary uploads under CLOUDINARY_FOLDER (default healthcare-products).
 *
 * Usage: node scripts/wipe-products-and-cloudinary.js [--skip-cloudinary]
 */
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

const { loadEnv } = require('../src/config/env');
loadEnv();

const prisma = require('../src/config/prisma');

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

async function wipeCloudinaryFolder() {
	if (!configureCloudinary()) {
		console.log(JSON.stringify({ cloudinary: 'skipped_missing_env' }));
		return;
	}
	const folder = process.env.CLOUDINARY_FOLDER || 'healthcare-products';
	let total = 0;
	let partial = true;
	while (partial) {
		const res = await cloudinary.api.delete_resources_by_prefix(folder, { resource_type: 'image' });
		const n = res.deleted ? Object.keys(res.deleted).length : 0;
		total += n;
		partial = Boolean(res.partial);
		if (!partial || n === 0) break;
	}
	console.log(JSON.stringify({ cloudinary: 'prefix_deleted', folder, deletedApprox: total }));
}

async function main() {
	const skipCloudinary = process.argv.includes('--skip-cloudinary');
	if (!skipCloudinary) await wipeCloudinaryFolder();

	const deletedItems = await prisma.orderItem.deleteMany({});
	const deletedProducts = await prisma.product.deleteMany({});
	console.log(JSON.stringify({ db: { orderItems: deletedItems.count, products: deletedProducts.count } }));
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
