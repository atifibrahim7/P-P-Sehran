const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { signToken } = require('../../middleware/auth');
const { toApiRole } = require('../../lib/roles');
const { normalizeEmail } = require('../../lib/email');

async function login(email, password) {
	const normalized = normalizeEmail(email);
	if (!normalized) return null;
	const user = await prisma.user.findFirst({ where: { email: normalized, deletedAt: null } });
	if (!user) return null;
	const ok = await bcrypt.compare(password, user.password);
	if (!ok) return null;
	const role = toApiRole(user.role);
	const token = signToken({ userId: user.id, role });
	return {
		token,
		user: { id: user.id, role, name: user.name, email: user.email },
	};
}

module.exports = { login };
