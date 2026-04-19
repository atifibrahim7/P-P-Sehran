const { loadEnv } = require('./src/config/env');

loadEnv();

const { createServer } = require('./src/app');

const PORT = process.env.PORT || 3001;
const app = createServer();

app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
