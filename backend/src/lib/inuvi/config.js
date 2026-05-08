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

/** Fallback exam type when product.inuviExamTypeId is null (Inuvi int id). */
function getDefaultInuviExamTypeId() {
	const n = Number.parseInt(readEnv('INUVI_DEFAULT_EXAM_TYPE_ID', ''), 10);
	return Number.isFinite(n) ? n : null;
}

module.exports = {
	getInuviBaseUrl,
	getInuviAccessToken,
	getDefaultInuviExamTypeId,
};
