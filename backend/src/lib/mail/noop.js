function createNoopProvider() {
	return {
		async sendTransactional({ to, subject }) {
			// eslint-disable-next-line no-console
			console.log('[email:none]', { to, subject });
		},
	};
}

module.exports = { createNoopProvider };
