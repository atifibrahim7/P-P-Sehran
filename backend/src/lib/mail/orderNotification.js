const { getEmailProvider } = require('./index');

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatMoney(value) {
	const amount = Number(value || 0);
	return `$${amount.toFixed(2)}`;
}

function formatDate(value) {
	if (!value) return '';
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString().slice(0, 10);
}

function resolveRecipient(order) {
	if (order?.type === 'SELF') {
		const email = order?.practitioner?.user?.email || '';
		const name = order?.practitioner?.user?.name || 'Practitioner';
		return { to: email, recipientName: name, audience: 'practitioner' };
	}
	const email = order?.patient?.user?.email || '';
	const name = order?.patient?.user?.name || 'Patient';
	return { to: email, recipientName: name, audience: 'patient' };
}

function buildOrderRows(order) {
	const items = order?.items || [];
	const usePractitionerPrice = order?.type === 'SELF';
	return items
		.map((item) => {
			const name = item?.product?.name || 'Product';
			const quantity = Number(item?.quantity || 0);
			const unit = usePractitionerPrice ? item?.practitionerPrice : item?.patientPrice;
			return {
				name,
				quantity,
				unitPrice: formatMoney(unit),
				totalPrice: formatMoney(Number(unit || 0) * quantity),
			};
		})
		.filter((row) => row.quantity > 0);
}

function buildOrderEmailContent({ order, kind }) {
	const title = kind === 'paid' ? 'Payment confirmed' : 'Order confirmed';
	const subjectPrefix = kind === 'paid' ? 'Payment received' : 'Order created';
	const { recipientName, audience } = resolveRecipient(order);
	const orderRows = buildOrderRows(order);
	const orderId = order?.id || '';
	const totalAmount = formatMoney(order?.totalAmount);
	const createdAt = formatDate(order?.createdAt);
	const accent = '#1f7a8c';

	const textRows = orderRows
		.map((row) => `- ${row.name} x${row.quantity} (${row.unitPrice}) = ${row.totalPrice}`)
		.join('\n');

	const textContent = [
		`Hello ${recipientName},`,
		'',
		`${title} for order #${orderId}.`,
		createdAt ? `Date: ${createdAt}` : '',
		`Order type: ${audience === 'practitioner' ? 'Practitioner self' : 'Patient order'}`,
		'',
		'Items:',
		textRows || '- No items',
		'',
		`Total: ${totalAmount}`,
		'',
		'Thank you,',
		'P&P Sehran',
	]
		.filter(Boolean)
		.join('\n');

	const rowsHtml = orderRows.length
		? orderRows
				.map(
					(row) =>
						`<tr>
<td style="padding:10px;border-bottom:1px solid #eef2f7;">${escapeHtml(row.name)}</td>
<td style="padding:10px;border-bottom:1px solid #eef2f7;text-align:center;">${row.quantity}</td>
<td style="padding:10px;border-bottom:1px solid #eef2f7;text-align:right;">${row.unitPrice}</td>
<td style="padding:10px;border-bottom:1px solid #eef2f7;text-align:right;">${row.totalPrice}</td>
</tr>`
				)
				.join('')
		: `<tr><td colspan="4" style="padding:12px;text-align:center;color:#6b7280;">No items</td></tr>`;

	const htmlContent = `<div style="font-family:Arial,sans-serif;background:#f6f9fc;padding:24px;">
<table role="presentation" style="max-width:680px;width:100%;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e5e7eb;">
<tr>
<td style="background:${accent};padding:18px 24px;border-radius:10px 10px 0 0;color:#ffffff;">
<h2 style="margin:0;font-size:20px;">P&P Sehran</h2>
<p style="margin:6px 0 0 0;font-size:14px;opacity:.92;">${escapeHtml(title)}</p>
</td>
</tr>
<tr>
<td style="padding:24px;">
<p style="margin:0 0 14px 0;">Hello ${escapeHtml(recipientName)},</p>
<p style="margin:0 0 14px 0;">Your ${kind === 'paid' ? 'payment is confirmed' : 'order has been created'} for <strong>#${escapeHtml(orderId)}</strong>.</p>
<table role="presentation" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;font-size:14px;">
<thead>
<tr style="background:#f3f4f6;color:#111827;">
<th style="padding:10px;text-align:left;">Item</th>
<th style="padding:10px;text-align:center;">Qty</th>
<th style="padding:10px;text-align:right;">Unit</th>
<th style="padding:10px;text-align:right;">Line total</th>
</tr>
</thead>
<tbody>${rowsHtml}</tbody>
</table>
<p style="margin:0 0 6px 0;"><strong>Total:</strong> ${totalAmount}</p>
${createdAt ? `<p style="margin:0 0 6px 0;"><strong>Date:</strong> ${escapeHtml(createdAt)}</p>` : ''}
<p style="margin:0;"><strong>Order type:</strong> ${audience === 'practitioner' ? 'Practitioner self' : 'Patient order'}</p>
</td>
</tr>
</table>
</div>`;

	return {
		subject: `${subjectPrefix} - Order #${orderId}`,
		textContent,
		htmlContent,
	};
}

async function sendOrderNotificationEmail(order, kind) {
	const { to } = resolveRecipient(order);
	if (!to) return false;
	const provider = getEmailProvider();
	const { subject, textContent, htmlContent } = buildOrderEmailContent({ order, kind });
	await provider.sendTransactional({ to, subject, textContent, htmlContent });
	return true;
}

async function sendOrderCreatedEmail(order) {
	return sendOrderNotificationEmail(order, 'created');
}

async function sendOrderPaidEmail(order) {
	return sendOrderNotificationEmail(order, 'paid');
}

module.exports = {
	resolveRecipient,
	buildOrderEmailContent,
	sendOrderCreatedEmail,
	sendOrderPaidEmail,
};
