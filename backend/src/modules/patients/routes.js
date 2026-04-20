const { Router } = require('express');
const { ok } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');

/**
 * Practitioner: list patients in the system (searchable).
 * Any practitioner may shop / place orders for any patient user.
 * primaryPractitionerName is set when the patient record has a linked clinic practitioner (optional legacy field).
 *
 * Response 200:
 * { success: true, data: Array<{ patientId, userId, name, email, primaryPractitionerName }> }
 */
const router = Router();

router.get('/', authenticateToken, requireRole('practitioner'), async (req, res) => {
	const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
	const where = q
		? {
				user: {
					OR: [{ name: { contains: q } }, { email: { contains: q } }],
				},
			}
		: {};

	const rows = await prisma.patient.findMany({
		where,
		include: {
			user: { select: { id: true, name: true, email: true } },
			practitioner: { include: { user: { select: { name: true } } } },
		},
		orderBy: { id: 'asc' },
		take: 500,
	});
	const list = rows.map((p) => ({
		patientId: p.id,
		userId: p.user.id,
		name: p.user.name,
		email: p.user.email,
		primaryPractitionerName: p.practitioner?.user?.name ?? null,
	}));
	return ok(res, list);
});

module.exports = router;
