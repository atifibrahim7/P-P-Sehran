const jwt = require('jsonwebtoken');
const { requiredEnv } = require('../config/env');

const JWT_SECRET = () => requiredEnv('JWT_SECRET', 'dev_secret_change_me');

function authenticateToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];
	if (!token) {
		return res.status(401).json({ success: false, error: { message: 'Missing token' } });
	}
	try {
		const payload = jwt.verify(token, JWT_SECRET());
		req.user = { userId: payload.userId, role: payload.role };
		return next();
	} catch (e) {
		return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
	}
}

function requireRole(...roles) {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({ success: false, error: { message: 'Unauthenticated' } });
		}
		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
		}
		return next();
	};
}

function signToken(payload, options = {}) {
	return jwt.sign(payload, JWT_SECRET(), { expiresIn: '7d', ...options });
}

module.exports = { authenticateToken, requireRole, signToken };

