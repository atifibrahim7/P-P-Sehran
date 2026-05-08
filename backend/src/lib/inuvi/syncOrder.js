const prisma = require('../../config/prisma');
const { getDefaultInuviExamTypeId } = require('./config');
const { inuviRequest, extractUuid } = require('./client');
const { buildCreateOrderRequest, buildCreateOrderExamRequest } = require('./mapOrder');

const orderSyncInclude = {
	items: { include: { product: true } },
	patient: { include: { addresses: true, contacts: true } },
	practitioner: { include: { addresses: true, contacts: true } },
};

function summarizeErr(err) {
	if (!err) return 'Unknown error';
	if (err.code === 'INUVI_CONFIG') return err.message;
	const bits = [err.message];
	if (err.status) bits.push(`HTTP ${err.status}`);
	if (err.body && typeof err.body === 'object') {
		try {
			bits.push(JSON.stringify(err.body).slice(0, 800));
		} catch {
			// ignore
		}
	}
	return bits.filter(Boolean).join(' | ');
}

/**
 * Soft-sync: updates Order.inuviSyncError on failure; never throws to caller of createOrder.
 * @param {number} localOrderId
 */
async function syncOrderToInuvi(localOrderId) {
	const id = Number(localOrderId);
	if (Number.isNaN(id)) return;

	const order = await prisma.order.findUnique({
		where: { id },
		include: orderSyncInclude,
	});
	if (!order) return;

	if (order.inuviOrderId) {
		return;
	}

	const built = buildCreateOrderRequest(order);
	if (built.error) {
		await prisma.order.update({
			where: { id },
			data: { inuviSyncError: built.error },
		});
		return;
	}

	let inuviOrderUuid = null;
	try {
		let created = null;
		try {
			created = await inuviRequest('/api/v1.0/orders', {
				method: 'POST',
				body: built.body,
			});
		} catch (createErr) {
			// If Inuvi rejects ClientReference2 for this ordering customer, retry without it
			try {
				const body = { ...built.body };
				const hasClientRef2 = Object.prototype.hasOwnProperty.call(body, 'ClientReference2');
				const clientRef2Rejected =
					createErr && createErr.status === 400 && createErr.body && Array.isArray(createErr.body.errors)
						? createErr.body.errors.some((e) => String(e).includes('ClientReference2'))
						: false;
				if (hasClientRef2 && clientRef2Rejected) {
					delete body.ClientReference2;
					// retry without ClientReference2
					created = await inuviRequest('/api/v1.0/orders', {
						method: 'POST',
						body,
					});
				} else {
					throw createErr;
				}
			} catch (err2) {
				// rethrow original createErr if available to preserve original message
				throw createErr;
			}
		}
		inuviOrderUuid = extractUuid(created);
		if (!inuviOrderUuid) {
			throw Object.assign(new Error('Inuvi order response missing id'), { body: created });
		}

		await prisma.order.update({
			where: { id },
			data: {
				inuviOrderId: inuviOrderUuid,
				inuviSyncError: null,
				inuviSyncedAt: new Date(),
			},
		});

		const defaultExam = getDefaultInuviExamTypeId();
		const examErrors = [];
		for (const line of order.items) {
			const product = line.product;
			if (!product || product.category !== 'BLOOD_TEST') continue;
			const examTypeId = product.inuviExamTypeId ?? defaultExam;
			if (examTypeId == null) continue;

			let qty = 1;
			try {
				qty = Math.max(1, Math.min(50, Number.parseInt(line.quantity, 10) || 1));
			} catch {
				qty = 1;
			}
			const examBody = buildCreateOrderExamRequest(product, examTypeId);
			for (let i = 0; i < qty; i += 1) {
				try {
					await inuviRequest(`/api/v1.0/orders/${inuviOrderUuid}/orderexams`, {
						method: 'POST',
						body: examBody,
					});
				} catch (e) {
					examErrors.push(`exam product ${product.id}: ${summarizeErr(e)}`);
				}
			}
		}

		if (examErrors.length) {
			await prisma.order.update({
				where: { id },
				data: {
					inuviSyncError: `Inuvi order created; exam sync issues: ${examErrors.join(' ; ')}`,
				},
			});
		}
	} catch (err) {
		await prisma.order.update({
			where: { id },
			data: { inuviSyncError: summarizeErr(err) },
		});
	}
}

module.exports = {
	syncOrderToInuvi,
	orderSyncInclude,
};
