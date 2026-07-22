const { Router } = require('express');
const { ok, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { serializeTestResult } = require('../../lib/serialize');

const router = Router();

const testResultInclude = {
	order: {
		include: {
			patient: { include: { user: { select: { name: true } } } },
			practitioner: { include: { user: { select: { name: true } } } },
		},
	},
};

router.get('/results', authenticateToken, async (req, res) => {
	const uid = Number(req.user.userId);

	if (req.user.role === 'admin') {
		const rows = await prisma.testResult.findMany({ include: testResultInclude, orderBy: { id: 'desc' } });
		return ok(res, rows.map(serializeTestResult));
	}

	if (req.user.role === 'practitioner') {
		const rows = await prisma.testResult.findMany({
			where: {
				order: {
					practitioner: { userId: uid },
				},
			},
			include: testResultInclude,
			orderBy: { id: 'desc' },
		});
		return ok(res, rows.map(serializeTestResult));
	}

	if (req.user.role === 'patient') {
		// Visibility gate: patients only ever see reports the practitioner has approved.
		const rows = await prisma.testResult.findMany({
			where: {
				status: 'APPROVED',
				order: {
					patient: { userId: uid },
				},
			},
			include: testResultInclude,
			orderBy: { id: 'desc' },
		});
		return ok(res, rows.map(serializeTestResult));
	}

	return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
});

router.post('/results/webhook', async (req, res) => {
	const { orderId, resultUrl, summary } = req.body || {};
	if (!orderId || !resultUrl) return badRequest(res, 'orderId and resultUrl required');

	const id = Number(orderId);
	if (Number.isNaN(id)) return badRequest(res, 'Invalid orderId');

	const order = await prisma.order.findUnique({ where: { id } });
	if (!order) return badRequest(res, 'Invalid orderId');

	const row = await prisma.testResult.upsert({
		where: { orderId: id },
		create: {
			orderId: id,
			reportUrl: resultUrl,
			status: 'UPLOADED',
			summary: summary || null,
		},
		update: {
			reportUrl: resultUrl,
			summary: summary != null ? summary : undefined,
			status: 'UPLOADED',
		},
	});

	return ok(res, { received: true, id: row.id });
});

/** Practitioner approves a report: makes it visible to the patient. */
router.patch('/results/:id/approve', authenticateToken, requireRole('practitioner'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return badRequest(res, 'Invalid id');

	const existing = await prisma.testResult.findUnique({
		where: { id },
		include: { order: { include: { practitioner: true } } },
	});
	if (!existing) return res.status(404).json({ success: false, error: { message: 'Not found' } });
	if (existing.order?.practitioner?.userId !== Number(req.user.userId)) {
		return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}

	const updated = await prisma.testResult.update({
		where: { id },
		data: {
			status: 'APPROVED',
			approvedAt: new Date(),
			approvedByPractitionerId: existing.order.practitionerId,
		},
		include: testResultInclude,
	});
	return ok(res, serializeTestResult(updated));
});

/**
 * Manual / Contact Customer - placeholder only.
 * TODO: this will later trigger the real consultation/contact workflow (e.g. notify the practice,
 * create a follow-up task, email the patient). For now it just timestamps the request.
 */
router.post('/results/:id/contact', authenticateToken, requireRole('practitioner'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return badRequest(res, 'Invalid id');

	const existing = await prisma.testResult.findUnique({
		where: { id },
		include: { order: { include: { practitioner: true } } },
	});
	if (!existing) return res.status(404).json({ success: false, error: { message: 'Not found' } });
	if (existing.order?.practitioner?.userId !== Number(req.user.userId)) {
		return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}

	const updated = await prisma.testResult.update({ where: { id }, data: { contactRequestedAt: new Date() } });
	return ok(res, { requested: true, contactRequestedAt: updated.contactRequestedAt });
});

module.exports = router;
