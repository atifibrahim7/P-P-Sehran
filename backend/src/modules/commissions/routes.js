const { Router } = require('express');
const { ok, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const prisma = require('../../config/prisma');
const { serializeCommissionListItem } = require('../../lib/serialize');

const router = Router();

const commissionInclude = {
	practitioner: { include: { user: { select: { id: true, name: true, email: true } } } },
	order: {
		include: {
			patient: { include: { user: { select: { id: true, name: true, email: true } } } },
			items: { include: { product: true } },
		},
	},
};

function aggregateByPractitioner(rows) {
	const byPractitioner = new Map();
	for (const r of rows) {
		const uid = r.practitioner.userId;
		if (!byPractitioner.has(uid)) {
			byPractitioner.set(uid, {
				practitionerUserId: uid,
				practitionerName: r.practitioner.user.name,
				practitionerEmail: r.practitioner.user.email,
				totalAmount: 0,
				pendingAmount: 0,
				paidOutAmount: 0,
				orderCount: 0,
			});
		}
		const agg = byPractitioner.get(uid);
		const amt = Number(r.amount);
		agg.totalAmount += amt;
		if (r.payoutStatus === 'PAID') {
			agg.paidOutAmount += amt;
		} else {
			agg.pendingAmount += amt;
		}
		agg.orderCount += 1;
	}
	return Array.from(byPractitioner.values());
}

router.get('/', authenticateToken, async (req, res) => {
	if (req.user.role === 'admin') {
		const rows = await prisma.commission.findMany({
			include: commissionInclude,
			orderBy: { id: 'desc' },
		});
		const commissions = rows.map(serializeCommissionListItem);
		const totalsByPractitioner = aggregateByPractitioner(rows);
		const pendingPayoutTotal = rows
			.filter((r) => r.payoutStatus === 'PENDING')
			.reduce((s, r) => s + Number(r.amount), 0);
		const paidOutTotal = rows
			.filter((r) => r.payoutStatus === 'PAID')
			.reduce((s, r) => s + Number(r.amount), 0);

		return ok(res, {
			commissions,
			totalsByPractitioner,
			summary: {
				pendingPayoutTotal,
				paidOutTotal,
				lineCount: rows.length,
			},
		});
	}
	if (req.user.role === 'practitioner') {
		const pr = await prisma.practitioner.findUnique({
			where: { userId: Number(req.user.userId) },
		});
		if (!pr) return ok(res, []);
		const rows = await prisma.commission.findMany({
			where: { practitionerId: pr.id },
			include: commissionInclude,
			orderBy: { id: 'desc' },
		});
		return ok(res, rows.map(serializeCommissionListItem));
	}
	return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
});

/** Super admin: mark commission payout to practitioner as paid (or revert to pending). */
router.patch('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
	const id = Number(req.params.id);
	if (Number.isNaN(id)) return badRequest(res, 'Invalid id');
	const { payoutStatus } = req.body || {};
	if (!['PENDING', 'PAID'].includes(payoutStatus)) {
		return badRequest(res, 'payoutStatus must be PENDING or PAID');
	}
	const existing = await prisma.commission.findUnique({ where: { id } });
	if (!existing) return res.status(404).json({ success: false, error: { message: 'Commission not found' } });

	const updated = await prisma.commission.update({
		where: { id },
		data: { payoutStatus },
		include: commissionInclude,
	});
	return ok(res, serializeCommissionListItem(updated));
});

module.exports = router;
