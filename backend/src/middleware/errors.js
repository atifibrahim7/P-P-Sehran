function notFoundHandler(_req, res, _next) {
	res.status(404).json({ success: false, error: { message: 'Not Found' } });
}

function errorHandler(err, _req, res, _next) {
	const status = err.status || 500;
	const code = err.code || 'INTERNAL_ERROR';
	const message = err.message || 'Internal Server Error';
	const details = err.details || undefined;
	if (process.env.NODE_ENV !== 'test') {
		// eslint-disable-next-line no-console
		console.error(err);
	}
	res.status(status).json({ success: false, error: { code, message, details } });
}

module.exports = { notFoundHandler, errorHandler };

