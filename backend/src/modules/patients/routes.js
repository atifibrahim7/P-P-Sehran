const { Router } = require('express');
const { ok } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');

/**
 * Practitioner: list patients assigned to this practice.
 *
 * Response 200:
 * { success: true, data: Array<{ patientId, userId, name, email }> }
 */
const router = Router();

router.get('/', authenticateToken, requireRole('practitioner'), async (req, res) => {
	const pr = await prisma.practitioner.findUnique({
		where: { userId: Number(req.user.userId) },
	});
	if (!pr) return ok(res, []);
	const rows = await prisma.patient.findMany({
		where: { practitionerId: pr.id },
		include: { user: { select: { id: true, name: true, email: true } } },
		orderBy: { id: 'asc' },
	});
	const list = rows.map((p) => ({
		patientId: p.id,
		userId: p.user.id,
		name: p.user.name,
		email: p.user.email,
	}));
	return ok(res, list);
});

module.exports = router;
