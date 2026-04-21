const { getEmailProvider } = require('./index');

/**
 * @param {object} p
 * @param {string} p.to
 * @param {string} p.patientName
 * @param {string} p.loginEmail
 * @param {string} p.passwordPlain
 * @param {string} p.practitionerName
 * @param {string} [p.appPublicUrl]
 */
function buildPatientWelcomeContent({ patientName, loginEmail, passwordPlain, practitionerName, appPublicUrl }) {
	const loginLine = appPublicUrl ? `Sign in: ${appPublicUrl.replace(/\/$/, '')}/login` : 'Use the app sign-in page your clinic shared with you.';
	const text = [
		`Hello ${patientName},`,
		'',
		`${practitionerName} has registered you on our platform.`,
		'',
		'Your account:',
		`  Email: ${loginEmail}`,
		`  Password: ${passwordPlain}`,
		'',
		'Please sign in and change your password after your first login if prompted.',
		'',
		loginLine,
		'',
	].join('\n');

	const html = `<p>Hello ${escapeHtml(patientName)},</p>
<p><strong>${escapeHtml(practitionerName)}</strong> has registered you on our platform.</p>
<p><strong>Your account</strong></p>
<ul>
<li>Email: ${escapeHtml(loginEmail)}</li>
<li>Password: ${escapeHtml(passwordPlain)}</li>
</ul>
<p>Please sign in and change your password after your first login if prompted.</p>
<p>${escapeHtml(loginLine)}</p>`;

	return { subject: 'Your patient account', textContent: text, htmlContent: html };
}

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

async function sendPatientWelcomeEmail({ to, patientName, loginEmail, passwordPlain, practitionerName }) {
	const appPublicUrl = process.env.APP_PUBLIC_URL || '';
	const { subject, textContent, htmlContent } = buildPatientWelcomeContent({
		patientName,
		loginEmail,
		passwordPlain,
		practitionerName,
		appPublicUrl,
	});
	const provider = getEmailProvider();
	await provider.sendTransactional({ to, subject, textContent, htmlContent });
}

module.exports = { sendPatientWelcomeEmail, buildPatientWelcomeContent };
