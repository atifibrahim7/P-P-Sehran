/**
 * Adds Product.description when `prisma db push` cannot run (e.g. FK/index drift).
 * Safe to run multiple times — skips if the column already exists.
 */
require('dotenv').config();
const { loadEnv } = require('../src/config/env');
loadEnv();

const prisma = require('../src/config/prisma');

async function main() {
	const rows = await prisma.$queryRaw`
		SELECT COUNT(*) AS c
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME = 'Product'
			AND COLUMN_NAME = 'description'
	`;
	const exists = Number(rows[0]?.c) > 0;
	if (exists) {
		console.log('Column Product.description already exists — nothing to do.');
		return;
	}
	await prisma.$executeRawUnsafe(
		'ALTER TABLE `Product` ADD COLUMN `description` VARCHAR(191) NULL'
	);
	console.log('Added column Product.description.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
