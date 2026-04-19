/**
 * Creates Cart + CartItem tables if missing (when prisma db push fails).
 * Run: node scripts/create-cart-tables.js
 */
require('dotenv').config();
const { loadEnv } = require('../src/config/env');
loadEnv();

const prisma = require('../src/config/prisma');

async function tableExists(name) {
	const rows = await prisma.$queryRaw`
		SELECT COUNT(*) AS c FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${name}
	`;
	return Number(rows[0]?.c) > 0;
}

async function main() {
	if (await tableExists('Cart')) {
		console.log('Table Cart already exists — skipping DDL.');
		return;
	}
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

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
