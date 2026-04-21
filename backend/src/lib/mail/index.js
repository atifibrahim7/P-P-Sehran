const { createBrevoProvider } = require('./brevo');
const { createNoopProvider } = require('./noop');

function getEmailProvider() {
	const p = String(process.env.EMAIL_PROVIDER || 'none').toLowerCase();
	if (p === 'brevo') return createBrevoProvider();
	return createNoopProvider();
}

module.exports = { getEmailProvider };
