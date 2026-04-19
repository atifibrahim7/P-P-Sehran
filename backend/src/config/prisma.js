const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('@prisma/client');

function parseMysqlUrl(urlString) {
	if (!urlString) {
		throw new Error('DATABASE_URL is not set. Load env before importing this module (see index.js).');
	}
	const u = new URL(urlString);
	const database = u.pathname.replace(/^\//, '').split('?')[0];
	return {
		host: u.hostname,
		port: u.port ? Number(u.port) : 3306,
		user: decodeURIComponent(u.username || ''),
		password: decodeURIComponent(u.password || ''),
		database: database || undefined,
	};
}

const adapter = new PrismaMariaDb(parseMysqlUrl(process.env.DATABASE_URL));
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
