/**
 * Adds OrderItem.quantity when `prisma db push` cannot run.
 * Safe to run multiple times — skips if the column already exists.
 */
require('dotenv').config();
const { loadEnv } = require('../src/config/env');
loadEnv();

const prisma = require('../src/config/prisma');

async function columnExists(tableName, columnName) {
	const rows = await prisma.$queryRaw`
		SELECT COUNT(*) AS c
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME = ${tableName}
			AND COLUMN_NAME = ${columnName}
	`;
	return Number(rows[0]?.c) > 0;
}

async function main() {
	if (await columnExists('OrderItem', 'quantity')) {
		console.log('Column OrderItem.quantity already exists — nothing to do.');
		return;
	}
	await prisma.$executeRawUnsafe(
		'ALTER TABLE `OrderItem` ADD COLUMN `quantity` INT NOT NULL DEFAULT 1'
	);
	console.log('Added column OrderItem.quantity.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
