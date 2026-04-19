const { Router } = require('express');
const authRouter = require('./modules/auth/routes');
const usersRouter = require('./modules/users/routes');
const productsRouter = require('./modules/products/routes');
const vendorsRouter = require('./modules/vendors/routes');
const ordersRouter = require('./modules/orders/routes');
const commissionsRouter = require('./modules/commissions/routes');
const labRouter = require('./modules/lab/routes');
const paymentsRouter = require('./modules/payments/routes');
const uploadsRouter = require('./modules/uploads/routes');
const cartsRouter = require('./modules/carts/routes');
const practitionerPatientsRouter = require('./modules/patients/routes');

function createApiRouter() {
	const router = Router();
	router.use('/auth', authRouter);
	router.use('/users', usersRouter);
	/** Business alias: GET /api/patients (same as former GET /api/users/patients) */
	router.use('/patients', practitionerPatientsRouter);
	router.use('/products', productsRouter);
	router.use('/vendors', vendorsRouter);
	router.use('/orders', ordersRouter);
	router.use('/commissions', commissionsRouter);
	router.use('/lab', labRouter);
	router.use('/payments', paymentsRouter);
	router.use('/uploads', uploadsRouter);
	router.use('/carts', cartsRouter);
	return router;
}

module.exports = { createApiRouter };

