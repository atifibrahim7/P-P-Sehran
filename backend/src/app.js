const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createApiRouter } = require('./routes');
const cartsRouter = require('./modules/carts/routes');
const practitionerPatientsRouter = require('./modules/patients/routes');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const { setupSwagger } = require('./swagger');

function createServer() {
	const app = express();

	// Middlewares
	app.use(helmet());
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	if (process.env.NODE_ENV !== 'test') {
		app.use(morgan('dev'));
	}

	// Swagger
	setupSwagger(app);

	// Health (includes DB check so you can confirm Prisma/MySQL + seeded users)
	app.get('/health', async (_req, res) => {
		const payload = { status: 'ok', service: 'healthcare-backend' };
		try {
			const prisma = require('./config/prisma');
			const userCount = await prisma.user.count();
			const schemaRows = await prisma.$queryRaw`
				SELECT
					(SELECT COUNT(*) FROM information_schema.COLUMNS
					 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'TestResult' AND COLUMN_NAME = 'summary') AS testResultSummary,
					(SELECT COUNT(*) FROM information_schema.TABLES
					 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Cart') AS cartTable
			`;
			const s = schemaRows[0] || {};
			payload.database = {
				connected: true,
				userCount,
				schema: {
					testResultSummaryColumn: Number(s.testResultSummary) > 0,
					cartTable: Number(s.cartTable) > 0,
				},
			};
		} catch (e) {
			payload.database = { connected: false, error: e.message };
		}
		res.json(payload);
	});

	// API
	app.use('/api', createApiRouter());
	/** Same handlers without /api prefix (Postman / legacy clients). */
	app.use('/carts', cartsRouter);
	app.use('/patients', practitionerPatientsRouter);

	// 404 and Error
	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}

module.exports = { createServer };

