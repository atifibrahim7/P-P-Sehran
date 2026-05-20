const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const { getInuviWebhookAllowedIps } = require('./config');

let cloudinaryConfigured = false;

function ensureCloudinaryConfigured() {
	if (cloudinaryConfigured) return true;
	const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
	if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
		return false;
	}
	cloudinary.config({
		cloud_name: CLOUDINARY_CLOUD_NAME,
		api_key: CLOUDINARY_API_KEY,
		api_secret: CLOUDINARY_API_SECRET,
	});
	cloudinaryConfigured = true;
	return true;
}

function normalizeIp(ip) {
	if (!ip) return '';
	const value = String(ip).trim();
	return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function getRequestIp(req) {
	const forwardedFor = req.headers['x-forwarded-for'];
	if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
		return normalizeIp(forwardedFor.split(',')[0]);
	}
	return normalizeIp(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress);
}

function isAllowedInuviWebhookIp(req, allowedIps = getInuviWebhookAllowedIps()) {
	const ip = getRequestIp(req);
	if (!ip) return false;
	return allowedIps.includes(ip);
}

function verifyInuviSignature(req, sharedSecret) {
	if (!sharedSecret) return false;
	const signatureHeader = req.headers['webhook-signature'];
	const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
	if (!signature || typeof signature !== 'string') return false;

	let jsonString = JSON.stringify(req.body, null, 2);
	jsonString = jsonString.replace(/\n/g, '\r\n');

	const expected = crypto.createHmac('sha256', sharedSecret).update(jsonString, 'utf-8').digest('hex');
	const expectedBuffer = Buffer.from(expected.trim().toLowerCase(), 'utf8');
	const providedBuffer = Buffer.from(String(signature).trim().toLowerCase(), 'utf8');
	if (expectedBuffer.length !== providedBuffer.length) return false;
	return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function safeSegment(value, fallback = 'unknown') {
	const text = String(value || '').trim().toLowerCase();
	const cleaned = text.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return cleaned || fallback;
}

function getActivityCode(payload) {
	const description = String(payload?.event?.activity_description || '').trim();
	const match = description.match(/^(\d{3})\b/);
	return match ? match[1] : 'unknown';
}

function buildWebhookArchiveOptions(payload, receivedAt = new Date()) {
	const event = payload?.event || {};
	const year = String(receivedAt.getUTCFullYear());
	const month = String(receivedAt.getUTCMonth() + 1).padStart(2, '0');
	const day = String(receivedAt.getUTCDate()).padStart(2, '0');
	const activityCode = getActivityCode(payload);
	const folder = process.env.CLOUDINARY_INUVI_WEBHOOK_FOLDER || 'healthcare-webhooks/inuvi';
	const publicId = [
		year,
		month,
		day,
		`activity-${activityCode}`,
		`order-${safeSegment(event.order_id)}`,
		`exam-${safeSegment(event.order_exam_id)}`,
		`event-${safeSegment(event.event_id)}`,
	].join('/');

	return {
		folder,
		publicId,
		activityCode,
		context: {
			test_webhook: String(payload?.test_webhook || ''),
			activity_code: String(activityCode),
			order_id: String(event.order_id || ''),
			order_exam_id: String(event.order_exam_id || ''),
			event_id: String(event.event_id || ''),
			policy_number: String(event.policy_number || ''),
		},
	};
}

async function archiveInuviWebhookPayload(payload) {
	if (!ensureCloudinaryConfigured()) {
		return { stored: false, reason: 'cloudinary-not-configured' };
	}

	const receivedAt = new Date();
	const meta = buildWebhookArchiveOptions(payload, receivedAt);
	const rawPayload = JSON.stringify(
		{
			receivedAt: receivedAt.toISOString(),
			payload,
		},
		null,
		2,
	);

	const result = await new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				folder: meta.folder,
				public_id: meta.publicId,
				resource_type: 'raw',
				format: 'json',
				overwrite: true,
				type: 'upload',
				context: meta.context,
				tags: ['inuvi', 'webhook', `activity-${meta.activityCode}`],
			},
			(err, data) => {
				if (err) reject(err);
				else resolve(data);
			},
		);
		stream.end(Buffer.from(rawPayload, 'utf8'));
	});

	return {
		stored: true,
		publicId: result.public_id,
		url: result.secure_url,
		activityCode: meta.activityCode,
	};
}

module.exports = {
	archiveInuviWebhookPayload,
	buildWebhookArchiveOptions,
	getActivityCode,
	isAllowedInuviWebhookIp,
	verifyInuviSignature,
};