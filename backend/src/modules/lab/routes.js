const { Router } = require('express');
const { ok, badRequest } = require('../../utils/response');
const { authenticateToken } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { serializeTestResult } = require('../../lib/serialize');

const router = Router();

router.get('/results', authenticateToken, async (req, res) => {
	const uid = Number(req.user.userId);

	if (req.user.role === 'admin') {
		const rows = await prisma.testResult.findMany({ orderBy: { id: 'desc' } });
		return ok(res, rows.map(serializeTestResult));
	}

	if (req.user.role === 'practitioner') {
		const rows = await prisma.testResult.findMany({
			where: {
				order: {
					practitioner: { userId: uid },
				},
			},
			orderBy: { id: 'desc' },
		});
		return ok(res, rows.map(serializeTestResult));
	}

	if (req.user.role === 'patient') {
		const rows = await prisma.testResult.findMany({
			where: {
				order: {
					patient: { userId: uid },
				},
			},
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
			status: 'received',
			summary: summary || null,
		},
		update: {
			reportUrl: resultUrl,
			summary: summary != null ? summary : undefined,
			status: 'received',
		},
	});

	return ok(res, { received: true, id: row.id });
});

module.exports = router;
