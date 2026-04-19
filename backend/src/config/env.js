const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
	const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
	dotenv.config({ path: path.resolve(process.cwd(), envFile) });
	dotenv.config(); // fallback to .env
}

const requiredEnv = (key, fallback = undefined) => {
	const v = process.env[key] ?? fallback;
	if (v === undefined) {
		throw new Error(`Missing required env var: ${key}`);
	}
	return v;
};

module.exports = { loadEnv, requiredEnv };

