const { Router } = require('express');
const { ok, badRequest } = require('../../utils/response');
const { login } = require('./service');

const router = Router();

router.post('/login', async (req, res) => {
	const { email, password } = req.body || {};
	if (!email || !password) {
		return badRequest(res, 'email and password are required');
	}
	const result = await login(email, password);
	if (!result) return res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
	return ok(res, result);
});

module.exports = router;

