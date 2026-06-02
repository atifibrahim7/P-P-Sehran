const { getInuviBaseUrl, getInuviAccessToken } = require('./config');

const DEFAULT_TIMEOUT_MS = 30000;

function buildUrl(path) {
	const base = getInuviBaseUrl();
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${base}${p}`;
}

/**
 * @param {string} path e.g. /api/v1.0/orders
 * @param {{ method?: string, body?: object, timeoutMs?: number }} opts
 */
async function inuviRequest(path, opts = {}) {
	const token = getInuviAccessToken();
	if (!token) {
		const err = new Error('INUVI_ACCESS_TOKEN is not configured');
		err.code = 'INUVI_CONFIG';
		throw err;
	}
	const method = opts.method || 'GET';
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const headers = {
			Accept: 'application/json',
			Authorization: `Bearer ${token}`,
		};
		const init = {
			method,
			headers,
			signal: controller.signal,
		};
		if (opts.body != null) {
			headers['Content-Type'] = 'application/json';
			init.body = JSON.stringify(opts.body);
		}
		const res = await fetch(buildUrl(path), init);
		const text = await res.text();
		let json = null;
		if (text) {
			try {
				json = JSON.parse(text);
			} catch {
				json = { raw: text.slice(0, 500) };
			}
		}
		if (!res.ok) {
			const msg =
				(json && (json.message || json.Message || json.title)) ||
				`Inuvi HTTP ${res.status}: ${text ? text.slice(0, 300) : ''}`;
			const err = new Error(String(msg).trim() || `Inuvi HTTP ${res.status}`);
			err.status = res.status;
			err.body = json || text;
			throw err;
		}
		return json;
	} finally {
		clearTimeout(timer);
	}
}

function extractUuid(obj) {
	if (!obj || typeof obj !== 'object') return null;
	const v = obj.id ?? obj.Id;
	if (typeof v === 'string' && v.length >= 32) return v;
	return null;
}

module.exports = {
	inuviRequest,
	extractUuid,
};
