function readEnv(name, fallback = '') {
	const v = process.env[name];
	if (v == null || String(v).trim() === '') return fallback;
	return String(v).trim();
}

function getInuviBaseUrl() {
	return readEnv('INUVI_API_BASE_URL', 'https://stg.api.pulse.inuvi.co.uk').replace(/\/$/, '');
}

function getInuviAccessToken() {
	return readEnv('INUVI_ACCESS_TOKEN', '');
}

function getInuviWebhookSecret() {
	return readEnv('INUVI_WEBHOOK_SECRET', '');
}

function getInuviWebhookAllowedIps() {
	const defaultIps = [
		'52.50.231.77',
		'52.49.106.238',
		'34.242.1.151',
		'34.241.212.216',
		'52.50.77.113',
		'52.51.75.226',
		'52.18.21.121',
		'52.210.133.191',
	];
	const raw = readEnv('INUVI_WEBHOOK_ALLOWED_IPS', '');
	const ips = raw ? raw.split(',').map((ip) => String(ip).trim()).filter(Boolean) : defaultIps;
	return [...new Set(ips)];
}

function getInuviSampleToLabId() {
	return readEnv('INUVI_SAMPLE_TO_LAB_ID', 'E54537E1-E8F8-E511-8134-025FE46D3D9D');
}

/** Fallback exam type when product.inuviExamTypeId is null (Inuvi int id). */
function getDefaultInuviExamTypeId() {
	const n = Number.parseInt(readEnv('INUVI_DEFAULT_EXAM_TYPE_ID', ''), 10);
	return Number.isFinite(n) ? n : null;
}

module.exports = {
	getInuviBaseUrl,
	getInuviAccessToken,
	getInuviWebhookSecret,
	getInuviWebhookAllowedIps,
	getInuviSampleToLabId,
	getDefaultInuviExamTypeId,
};
