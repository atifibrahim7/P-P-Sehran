const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

function createBrevoProvider() {
	const apiKey = process.env.BREVO_API_KEY || '';
	const fromEmail = process.env.EMAIL_FROM_EMAIL || '';
	const fromName = process.env.EMAIL_FROM_NAME || 'P&P Sehran';

	if (!apiKey || !fromEmail) {
		// eslint-disable-next-line no-console
		console.warn('[email:brevo] Missing BREVO_API_KEY or EMAIL_FROM_EMAIL — logging only');
		return {
			async sendTransactional(payload) {
				// eslint-disable-next-line no-console
				console.log('[email:brevo:skipped]', payload.to, payload.subject);
			},
		};
	}

	return {
		async sendTransactional({ to, subject, htmlContent, textContent }) {
			const body = {
				sender: { name: fromName, email: fromEmail },
				to: [{ email: to }],
				subject,
				...(htmlContent ? { htmlContent } : {}),
				...(textContent ? { textContent } : {}),
			};
			const res = await fetch(BREVO_URL, {
				method: 'POST',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
					'api-key': apiKey,
				},
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				const errText = await res.text().catch(() => '');
				throw Object.assign(new Error(`Brevo send failed: ${res.status} ${errText}`), { status: 502 });
			}
		},
	};
}

module.exports = { createBrevoProvider };
