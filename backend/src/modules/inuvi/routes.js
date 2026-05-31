const { Router } = require('express');
const { authenticateToken } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { inuviRequest } = require('../../lib/inuvi/client');
const { getInuviWebhookSecret } = require('../../lib/inuvi/config');
const {
	archiveInuviWebhookPayload,
	isAllowedInuviWebhookIp,
	verifyInuviSignature,
	getActivityCode,
} = require('../../lib/inuvi/webhook');
const { ok } = require('../../utils/response');

const router = Router();

let examTypesCache = null;
let examTypesCachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const INUVI_ACTIVITY_MESSAGES = {
	316: 'Surgery confirmed they have received the instruction',
	322: 'Surgery waiting for the customer to see the report before returning it to Inuvi',
	342: 'Practice posted the report to Inuvi',
	343: 'Surgery confirmed payment has been received',
	500: 'AMRA Outstanding',
	601: 'New order creation completed',
	603: 'Assigned to examiner',
	605: 'Scheduled exam placeholder',
	606: 'Rescheduled exam placeholder',
	610: 'Completed',
	611: 'Completed with omission',
	614: 'Status updated to cancelled',
	615: 'Status updated to on hold',
	616: 'Status updated to query',
	617: 'Evidence files uploaded on a completed case',
	653: 'DNA / did not attend',
	655: 'Status updated to cancelled due to inactivity',
};

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

router.post('/webhook', async (req, res) => {
	if (!isAllowedInuviWebhookIp(req)) {
		return res.status(403).send('Forbidden');
	}

	if (!verifyInuviSignature(req, getInuviWebhookSecret())) {
		return res.status(401).send('Invalid signature');
	}

	const payload = req.body;
	const activityCode = getActivityCode(payload);
	const event = payload?.event || {};
	const message = INUVI_ACTIVITY_MESSAGES[Number(activityCode)] || `Unhandled Inuvi event: ${activityCode}`;
	console.log(`[Inuvi webhook] ${message}`);

	try {
		await prisma.inuviWebhookPayload.create({
			data: {
				activityCode: activityCode === 'unknown' ? null : activityCode,
				payload,
			},
		});
		res.status(200).send('Webhook received');
	} catch (err) {
		console.error('[Inuvi webhook] database write failed:', err.message);
		return res.status(500).send('Failed to store webhook payload');
	}

	if (activityCode === '617') {
		console.log(`[Inuvi webhook] report ready for policy ${event.policy_number || 'unknown'}`);
	} else if (activityCode === '653') {
		console.log(`[Inuvi webhook] DNA for exam ${event.order_exam_id || 'unknown'}`);
	} else if (activityCode === '610') {
		console.log(`[Inuvi webhook] exam ${event.order_exam_id || 'unknown'} completed`);
	}

	setImmediate(() => {
		archiveInuviWebhookPayload(payload)
			.then((result) => {
				if (result?.stored) {
					console.log(`[Inuvi webhook] archived to Cloudinary: ${result.publicId}`);
				}
			})
			.catch((err) => {
				console.error('[Inuvi webhook] archive failed:', err.message);
			});
	});
});

module.exports = router;
