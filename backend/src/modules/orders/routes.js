const { Router } = require('express');
const { ok, created, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { createOrder, listOrdersForUser } = require('./service');
const { loadOrderWithRelations, serializeOrder, serializeOrderItem } = require('../../lib/serialize');

const router = Router();

router.get('/', authenticateToken, async (req, res, next) => {
	try {
		const orders = await listOrdersForUser(req.user);
		return ok(res, orders);
	} catch (e) {
		return next(e);
	}
});

router.get('/:id', authenticateToken, async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) {
		return res.status(404).json({ success: false, error: { message: 'Order not found' } });
	}
	const order = await loadOrderWithRelations(id);
	if (!order) return res.status(404).json({ success: false, error: { message: 'Order not found' } });

	const uid = Number(req.user.userId);
	const practitionerUid = order.practitioner ? order.practitioner.userId : null;
	const patientUid = order.patient ? order.patient.userId : null;

	if (
		req.user.role !== 'admin' &&
		!(req.user.role === 'practitioner' && practitionerUid === uid) &&
		!(req.user.role === 'patient' && patientUid === uid)
	) {
		return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
	}

	return ok(res, {
		order: serializeOrder(order),
		items: order.items.map(serializeOrderItem),
	});
});

router.post('/', authenticateToken, requireRole('admin', 'practitioner'), async (req, res, next) => {
	try {
		const { type, practitionerId, patientId, items } = req.body || {};
		const result = await createOrder({
			createdByUserId: req.user.userId,
			practitionerId: practitionerId || req.user.userId,
			patientId,
			type,
			items,
		});
		return created(res, result);
	} catch (e) {
		if (e.status) return next(e);
		return badRequest(res, e.message);
	}
});

module.exports = router;
