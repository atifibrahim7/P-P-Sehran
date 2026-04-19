const { Router } = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { ok, badRequest } = require('../../utils/response');
const { authenticateToken, requireRole } = require('../../middleware/auth');

const router = Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
	fileFilter: (_req, file, cb) => {
		if (file.mimetype && file.mimetype.startsWith('image/')) {
			return cb(null, true);
		}
		cb(new Error('Only image files are allowed'));
	},
});

let cloudinaryConfigured = false;

function configureCloudinary() {
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

/**
 * POST /api/uploads/image
 * multipart field name: file
 * Admin only. Returns { url, publicId }.
 */
router.post(
	'/image',
	authenticateToken,
	requireRole('admin'),
	(req, res, next) => {
		upload.single('file')(req, res, (err) => {
			if (err instanceof multer.MulterError) {
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.status(400).json({ success: false, error: { message: 'File too large (max 8MB)' } });
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
					error: {
						message:
							'Image upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server.',
					},
				});
			}
			if (!req.file || !req.file.buffer) {
				return badRequest(res, 'No file uploaded (use field name "file")');
			}

			const result = await new Promise((resolve, reject) => {
				const stream = cloudinary.uploader.upload_stream(
					{
						folder: process.env.CLOUDINARY_FOLDER || 'healthcare-products',
						resource_type: 'image',
					},
					(err, data) => {
						if (err) reject(err);
						else resolve(data);
					}
				);
				stream.end(req.file.buffer);
			});

			return ok(res, {
				url: result.secure_url,
				publicId: result.public_id,
				width: result.width,
				height: result.height,
			});
		} catch (e) {
			next(e);
		}
	}
);

module.exports = router;
