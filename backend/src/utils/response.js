function ok(res, data) {
	return res.json({ success: true, data });
}

function created(res, data) {
	return res.status(201).json({ success: true, data });
}

function badRequest(res, message, details) {
	return res.status(400).json({ success: false, error: { message, details } });
}

module.exports = { ok, created, badRequest };

