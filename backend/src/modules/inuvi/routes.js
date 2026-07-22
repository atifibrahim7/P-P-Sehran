const path = require('path');
const { Router } = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { parsePagination, paginateResult } = require('../../utils/pagination');
const prisma = require('../../config/prisma');
const { inuviRequest } = require('../../lib/inuvi/client');
const { getInuviWebhookSecret } = require('../../lib/inuvi/config');
const {
	archiveInuviWebhookPayload,
	isAllowedInuviWebhookIp,
	verifyInuviSignature,
	getActivityCode,
} = require('../../lib/inuvi/webhook');
const { parseInuviReportFilename } = require('../../lib/inuvi/reportFilename');
const { ok, badRequest } = require('../../utils/response');

const documentUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const DOCUMENT_CLOUDINARY_FOLDER =
	process.env.CLOUDINARY_INUVI_DOCUMENT_FOLDER || 'document-storage-api-inuivi';

function resolveDocumentUploadOptions(file, finalName, ext) {
	const isImage = file.mimetype?.startsWith('image/');
	const resourceType = isImage ? 'image' : 'raw';
	const baseId = path.basename(finalName, ext);
	// Raw assets need the extension in public_id so Cloudinary dashboard downloads keep the file type.
	const publicId = resourceType === 'raw' && ext ? `${baseId}${ext}` : baseId;
	return {
		folder: DOCUMENT_CLOUDINARY_FOLDER,
		public_id: publicId,
		resource_type: resourceType,
		overwrite: false,
	};
}
let cloudinaryConfigured = false;
function configureCloudinary() {
	if (cloudinaryConfigured) return true;
	const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
	if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false;
	cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
	cloudinaryConfigured = true;
	return true;
}

/**
 * Upserts the TestResult for an order to point at a freshly uploaded report, resetting approval
 * state - a corrected/re-issued report re-enters the practitioner approval queue instead of
 * silently staying approved (mirrors the /lab/results/webhook behavior).
 */
async function linkReportToOrder(orderId, reportUrl) {
	const tr = await prisma.testResult.upsert({
		where: { orderId },
		create: { orderId, reportUrl, status: 'UPLOADED' },
		update: { reportUrl, status: 'UPLOADED', approvedAt: null, approvedByPractitionerId: null },
	});
	return { linked: true, orderId, testResultId: tr.id };
}

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

/**
 * POST /api/inuvi/document-upload
 * multipart field name: file
 * Authenticated users only. Uploads a document to the document-storage-api-inuivi Cloudinary folder.
 */
function authenticateUploadToken(req, res, next) {
	const staticToken = process.env.INUIVI_UPLOAD_TOKEN;
	if (!staticToken) {
		return res.status(503).json({ success: false, error: { message: 'INUIVI_UPLOAD_TOKEN is not configured on the server.' } });
	}
	const bearer = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
	if (!bearer || bearer !== staticToken) {
		return res.status(401).json({ success: false, error: { message: 'Invalid or missing upload token.' } });
	}
	next();
}

router.post(
	'/document-upload',
	authenticateUploadToken,
	(req, res, next) => {
		documentUpload.single('file')(req, res, (err) => {
			if (err instanceof multer.MulterError) {
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.status(400).json({ success: false, error: { message: 'File too large (max 20MB)' } });
				}
				return res.status(400).json({ success: false, error: { message: err.message || 'Upload error' } });
			}
			if (err) {
				return res.status(400).json({ success: false, error: { message: err.message || 'Invalid file' } });
			}
			next();
		});
	},
	async (req, res, next) => {
		try {
			if (!configureCloudinary()) {
				return res.status(503).json({
					success: false,
					error: { message: 'Upload not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.' },
				});
			}
			if (!req.file || !req.file.buffer) {
				return badRequest(res, 'No file uploaded (use field name "file")');
			}

			const originalName = req.file.originalname || 'upload';
			const ext = path.extname(originalName);
			const rawBase = path.basename(originalName, ext);
			const base = ext && rawBase.endsWith(ext) ? rawBase.slice(0, -ext.length) : rawBase;

			// Find next available name to avoid duplicates. Filtered in JS rather than via a SQL
			// LIKE/startsWith - this DB's connector mixes collations on pattern-match queries and
			// throws ("Illegal mix of collations") for any Prisma contains/startsWith filter here.
			const allNames = await prisma.inuviDocument.findMany({ select: { originalName: true } });
			const prefix = `${base}(`;
			const takenNames = new Set(
				allNames.map((d) => d.originalName).filter((n) => n === originalName || n.startsWith(prefix))
			);
			let finalName = originalName;
			if (takenNames.has(finalName)) {
				let n = 1;
				while (takenNames.has(`${base}(${n})${ext}`)) n++;
				finalName = `${base}(${n})${ext}`;
			}

			const uploadOptions = resolveDocumentUploadOptions(req.file, finalName, ext);

			const result = await new Promise((resolve, reject) => {
				const stream = cloudinary.uploader.upload_stream(
					uploadOptions,
					(err, data) => {
						if (err) reject(err);
						else resolve(data);
					}
				);
				stream.end(req.file.buffer);
			});

			const doc = await prisma.inuviDocument.create({
				data: {
					originalName: finalName,
					publicId: result.public_id,
					url: result.secure_url,
					format: result.format || ext.replace('.', '') || null,
					bytes: result.bytes ?? null,
				},
			});

			// Link the report to a customer's order (and via Order.practitionerId, to their practitioner).
			// The real uploader (the lab's system) doesn't send form fields - it encodes everything in
			// the filename per the agreed convention "{Clinic}.{InuviRef}.{PolicyNumber}.{First}.{Last}.{Timestamp}".
			// Explicit policyNumber/inuviOrderId form fields are kept as a manual/test override only.
			const { policyNumber: explicitPolicyNumber, inuviOrderId: explicitInuviOrderId } = req.body || {};
			let link = { linked: false };

			if (explicitInuviOrderId) {
				const order = await prisma.order.findFirst({
					where: { inuviOrderId: String(explicitInuviOrderId) },
					include: { patient: true, practitioner: true },
				});
				if (order) {
					const expectedPolicy = order.patient?.policyNumber ?? order.practitioner?.policyNumber ?? null;
					if (explicitPolicyNumber && expectedPolicy && String(explicitPolicyNumber) !== String(expectedPolicy)) {
						console.warn(
							`[inuvi document-upload] policyNumber mismatch for order ${order.id}: got ${explicitPolicyNumber}, expected ${expectedPolicy}`
						);
					}
					link = await linkReportToOrder(order.id, doc.url);
				} else {
					console.warn(`[inuvi document-upload] no Order found for inuviOrderId=${explicitInuviOrderId}`);
				}
			} else {
				const parsed = parseInuviReportFilename(base);
				if (!parsed) {
					console.warn(`[inuvi document-upload] filename "${originalName}" does not match the agreed naming convention - stored unlinked`);
				} else {
					const patient = await prisma.patient.findFirst({ where: { policyNumber: parsed.policyNumber, deletedAt: null } });
					const practitioner = patient ? null : await prisma.practitioner.findFirst({ where: { policyNumber: parsed.policyNumber } });
					const customer = patient || practitioner;

					if (!customer) {
						console.warn(`[inuvi document-upload] no Patient/Practitioner found for policyNumber=${parsed.policyNumber} (from filename)`);
					} else {
						const expectedSurname = customer.surname;
						if (expectedSurname && parsed.lastName && expectedSurname.toLowerCase() !== parsed.lastName.toLowerCase()) {
							console.warn(
								`[inuvi document-upload] surname mismatch for policyNumber=${parsed.policyNumber}: filename says "${parsed.lastName}", record says "${expectedSurname}"`
							);
						}

						const customerFilter = patient ? { patientId: patient.id } : { practitionerId: practitioner.id, patientId: null };
						const candidateOrders = await prisma.order.findMany({
							where: { ...customerFilter, testResult: { is: null } },
							orderBy: { createdAt: 'desc' },
							take: 10,
						});

						if (candidateOrders.length === 0) {
							console.warn(`[inuvi document-upload] no Order without an existing report found for policyNumber=${parsed.policyNumber} (inuviReference=${parsed.inuviReference})`);
						} else {
							// inuviReference from the filename carries a trailing exam-sequence suffix (e.g. "0000652404-1")
							// that Order.inuviRef (Inuvi's bare MssRefNumber) doesn't have - compare on the numeric prefix.
							const refBase = parsed.inuviReference.split('-')[0];
							const matched = candidateOrders.find((o) => o.inuviRef && o.inuviRef === refBase);
							if (!matched && candidateOrders.length > 1) {
								console.warn(
									`[inuvi document-upload] policyNumber=${parsed.policyNumber} has multiple orders awaiting a report and inuviReference=${parsed.inuviReference} matched none of their inuviRef values - attaching to the most recent (order ${candidateOrders[0].id})`
								);
							}
							link = await linkReportToOrder((matched || candidateOrders[0]).id, doc.url);
						}
					}
				}
			}

			return ok(res, {
				id: doc.id,
				originalName: doc.originalName,
				url: doc.url,
				publicId: doc.publicId,
				format: doc.format,
				bytes: doc.bytes,
				...link,
			});
		} catch (e) {
			next(e);
		}
	}
);

/**
 * GET /api/inuvi/documents
 * Admin and practitioner only. Returns paginated list of uploaded documents, searchable by original filename.
 */
router.get('/documents', authenticateToken, requireRole('admin', 'practitioner'), async (req, res, next) => {
	try {
		const { page, pageSize } = parsePagination(req.query);
		const q = req.query.q ? String(req.query.q).trim() : '';

		const where = q ? { originalName: { contains: q } } : {};

		const [total, items] = await Promise.all([
			prisma.inuviDocument.count({ where }),
			prisma.inuviDocument.findMany({
				where,
				orderBy: { uploadedAt: 'desc' },
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
		]);

		return ok(res, paginateResult(items, page, pageSize, total));
	} catch (e) {
		next(e);
	}
});

module.exports = router;
