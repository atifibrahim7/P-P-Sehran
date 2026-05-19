const { Router } = require('express');
const { authenticateToken } = require('../../middleware/auth');
const { inuviRequest } = require('../../lib/inuvi/client');
const { ok } = require('../../utils/response');

const router = Router();

let examTypesCache = null;
let examTypesCachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

router.get('/exam-types', authenticateToken, async (req, res, next) => {
	try {
		const now = Date.now();
		if (examTypesCache && now - examTypesCachedAt < CACHE_TTL_MS) {
			return ok(res, { data: examTypesCache });
		}
		const result = await inuviRequest('/api/v1.0/examTypes');
		const rows = Array.isArray(result) ? result : [];
		const data = rows.map((r) => ({ id: r.Id, name: r.Name }));
		examTypesCache = data;
		examTypesCachedAt = now;
		return ok(res, { data });
	} catch (err) {
		return next(err);
	}
});

module.exports = router;
