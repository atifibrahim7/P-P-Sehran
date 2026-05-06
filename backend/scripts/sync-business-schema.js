/**
 * Aligns MySQL with prisma/schema.prisma when `prisma db push` is blocked by drift.
 * Idempotent — safe to run multiple times.
 *
 * Run: node scripts/sync-business-schema.js
 * Or:  npm run db:sync
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

async function tableExists(name) {
	const rows = await prisma.$queryRaw`
		SELECT COUNT(*) AS c FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${name}
	`;
	return Number(rows[0]?.c) > 0;
}

/** Init migration had Order.patientId NOT NULL; self-orders require NULL. */
/** Standalone patient carts: nullable practitionerId + PATIENT_DIRECT scope */
async function ensureCartStandalonePatient() {
	if (!(await tableExists('Cart'))) return;
	const rows = await prisma.$queryRaw`
		SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Cart' AND COLUMN_NAME = 'practitionerId'
	`;
	if (!rows?.length) return;
	if (rows[0].n === 'NO') {
		await prisma.$executeRawUnsafe('ALTER TABLE `Cart` MODIFY `practitionerId` INTEGER NULL');
		console.log('Altered Cart.practitionerId to NULL (standalone patient carts).');
	}
	const scopeRows = await prisma.$queryRaw`
		SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Cart' AND COLUMN_NAME = 'scope'
	`;
	const t = String(scopeRows[0]?.t ?? '');
	if (t && !t.includes('PATIENT_DIRECT')) {
		await prisma.$executeRawUnsafe(
			"ALTER TABLE `Cart` MODIFY `scope` ENUM('SELF', 'PATIENT', 'PATIENT_DIRECT') NOT NULL",
		);
		console.log('Extended Cart.scope with PATIENT_DIRECT.');
	}
}

async function ensureOrderPatientIdNullable() {
	const rows = await prisma.$queryRaw`
		SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'patientId'
	`;
	if (!rows?.length) {
		console.log('Order.patientId column not found — skip nullable fix.');
		return;
	}
	if (rows[0].n === 'NO') {
		await prisma.$executeRawUnsafe('ALTER TABLE `Order` MODIFY `patientId` INTEGER NULL');
		console.log('Altered Order.patientId to NULL (practitioner self-orders).');
	} else {
		console.log('Order.patientId already nullable.');
	}
}

async function main() {
	if (!(await columnExists('TestResult', 'summary'))) {
		await prisma.$executeRawUnsafe(
			'ALTER TABLE `TestResult` ADD COLUMN `summary` VARCHAR(191) NULL'
		);
		console.log('Added column TestResult.summary.');
	} else {
		console.log('Column TestResult.summary already exists.');
	}

	if (!(await columnExists('Product', 'description'))) {
		await prisma.$executeRawUnsafe(
			'ALTER TABLE `Product` ADD COLUMN `description` VARCHAR(191) NULL'
		);
		console.log('Added column Product.description.');
	} else {
		console.log('Column Product.description already exists.');
	}

	if (!(await columnExists('OrderItem', 'quantity'))) {
		await prisma.$executeRawUnsafe(
			'ALTER TABLE `OrderItem` ADD COLUMN `quantity` INT NOT NULL DEFAULT 1'
		);
		console.log('Added column OrderItem.quantity.');
	} else {
		console.log('Column OrderItem.quantity already exists.');
	}

	if (!(await columnExists('Commission', 'payoutStatus'))) {
		await prisma.$executeRawUnsafe(
			"ALTER TABLE `Commission` ADD COLUMN `payoutStatus` ENUM('PENDING','PAID') NOT NULL DEFAULT 'PENDING'"
		);
		console.log('Added column Commission.payoutStatus.');
	} else {
		console.log('Column Commission.payoutStatus already exists.');
	}

	await ensureOrderPatientIdNullable();
	await ensureCartStandalonePatient();

	if (await tableExists('Cart')) {
		console.log('Table Cart already exists — skipping cart DDL.');
	} else {
		await prisma.$executeRawUnsafe(`
CREATE TABLE \`Cart\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`practitionerId\` INT NOT NULL,
  \`scope\` ENUM('SELF','PATIENT') NOT NULL,
  \`patientId\` INT NULL,
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  INDEX \`Cart_practitionerId_scope_patientId_idx\` (\`practitionerId\`, \`scope\`, \`patientId\`),
  CONSTRAINT \`Cart_practitionerId_fkey\` FOREIGN KEY (\`practitionerId\`) REFERENCES \`Practitioner\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`Cart_patientId_fkey\` FOREIGN KEY (\`patientId\`) REFERENCES \`Patient\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`);
		await prisma.$executeRawUnsafe(`
CREATE TABLE \`CartItem\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`cartId\` INT NOT NULL,
  \`productId\` INT NOT NULL,
  \`quantity\` INT NOT NULL DEFAULT 1,
  \`addedBy\` ENUM('PRACTITIONER','PATIENT') NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`CartItem_cartId_productId_key\` (\`cartId\`, \`productId\`),
  CONSTRAINT \`CartItem_cartId_fkey\` FOREIGN KEY (\`cartId\`) REFERENCES \`Cart\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`CartItem_productId_fkey\` FOREIGN KEY (\`productId\`) REFERENCES \`Product\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`);
		console.log('Created tables Cart and CartItem.');
	}

	console.log('Business schema sync finished.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
