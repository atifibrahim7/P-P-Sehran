const swaggerUi = require('swagger-ui-express');

function buildSpec() {
	return {
		openapi: '3.0.3',
		info: {
			title: 'Healthcare Platform API',
			version: '1.0.0',
			description: 'REST API documentation for Admin, Practitioner, and Patient portals'
		},
		servers: [{ url: 'http://localhost:3001/api' }],
		tags: [
			{ name: 'Auth', description: 'Authentication endpoints' },
			{ name: 'Users', description: 'User profiles and admin user management' },
			{ name: 'Vendors', description: 'Vendors management (labs and supplement vendors)' },
			{ name: 'Products', description: 'Products catalog: blood tests and supplements' },
			{ name: 'Orders', description: 'Orders, order items, order state' },
			{ name: 'Payments', description: 'Stripe checkout and webhooks' },
			{ name: 'Commissions', description: 'Practitioner commissions' },
			{ name: 'Lab', description: 'Lab integration and test results' }
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT'
				}
			},
			schemas: {
				SuccessEnvelope: {
					type: 'object',
					properties: { success: { type: 'boolean' }, data: {} },
					required: ['success', 'data']
				},
				ErrorEnvelope: {
					type: 'object',
					properties: {
						success: { type: 'boolean' },
						error: {
							type: 'object',
							properties: {
								message: { type: 'string' },
								code: { type: 'string' },
								details: {}
							},
							required: ['message']
						}
					},
					required: ['success', 'error']
				},
				Role: { type: 'string', enum: ['admin', 'practitioner', 'patient'] },
				User: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						email: { type: 'string' },
						name: { type: 'string' },
						role: { $ref: '#/components/schemas/Role' }
					},
					required: ['id', 'email', 'name', 'role']
				},
				Vendor: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						name: { type: 'string' },
						type: { type: 'string', enum: ['lab', 'supplement', 'both'] }
					},
					required: ['id', 'name', 'type']
				},
				Product: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						name: { type: 'string' },
						category: { type: 'string', enum: ['blood_test', 'supplement'] },
						vendorId: { type: 'string', format: 'uuid' },
						vendorName: { type: ['string', 'null'] },
						patient_price: { type: 'number' },
						practitioner_price: { type: 'number' }
					},
					required: ['id', 'name', 'category', 'vendorId', 'patient_price', 'practitioner_price']
				},
				Order: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						type: { type: 'string', enum: ['practitioner_self', 'patient'] },
						practitionerId: { type: 'string', format: 'uuid' },
						practitionerName: { type: ['string', 'null'] },
						practitionerEmail: { type: ['string', 'null'] },
						patientId: { type: ['string', 'null'], format: 'uuid' },
						patientName: { type: ['string', 'null'] },
						patientEmail: { type: ['string', 'null'] },
						state: { type: 'string', enum: ['pending', 'paid', 'processing', 'completed'] },
						total_patient: { type: 'number' },
						total_practitioner: { type: 'number' },
						createdAt: { type: 'string' },
						paidAt: { type: 'string' }
					},
					required: ['id', 'type', 'practitionerId', 'state', 'total_patient', 'total_practitioner', 'createdAt']
				},
				OrderItem: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						orderId: { type: 'string', format: 'uuid' },
						productId: { type: 'string', format: 'uuid' },
						quantity: { type: 'integer' },
						unit_patient_price: { type: 'number' },
						unit_practitioner_price: { type: 'number' }
					},
					required: ['id', 'orderId', 'productId', 'quantity', 'unit_patient_price', 'unit_practitioner_price']
				},
				Commission: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						orderId: { type: 'string', format: 'uuid' },
						practitionerId: { type: 'string', format: 'uuid' },
						amount: { type: 'number' },
						createdAt: { type: 'string' }
					},
					required: ['id', 'orderId', 'practitionerId', 'amount', 'createdAt']
				},
				TestResult: {
					type: 'object',
					properties: {
						id: { type: 'string', format: 'uuid' },
						orderId: { type: 'string', format: 'uuid' },
						resultUrl: { type: 'string' },
						summary: { type: 'string' },
						receivedAt: { type: 'string' }
					},
					required: ['id', 'orderId', 'resultUrl', 'receivedAt']
				},
				LoginRequest: {
					type: 'object',
					properties: { email: { type: 'string' }, password: { type: 'string' } },
					required: ['email', 'password']
				},
				LoginResponse: {
					type: 'object',
					properties: {
						token: { type: 'string' },
						user: { $ref: '#/components/schemas/User' }
					},
					required: ['token', 'user']
				},
				CheckoutRequest: {
					type: 'object',
					properties: {
						orderId: { type: 'string', format: 'uuid' },
						successUrl: { type: 'string' },
						cancelUrl: { type: 'string' }
					},
					required: ['orderId', 'successUrl', 'cancelUrl']
				},
				CreateOrderRequest: {
					type: 'object',
					properties: {
						type: { type: 'string', enum: ['practitioner_self', 'patient'] },
						practitionerId: { type: 'string', format: 'uuid' },
						patientId: { type: 'string', format: 'uuid' },
						items: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									productId: { type: 'string', format: 'uuid' },
									quantity: { type: 'integer', minimum: 1, default: 1 }
								},
								required: ['productId']
							}
						}
					},
					required: ['type', 'items']
				},
				UpdateOrderStateRequest: {
					type: 'object',
					properties: { state: { type: 'string', enum: ['pending', 'paid', 'processing', 'completed'] } },
					required: ['state']
				}
			}
		},
		security: [{ bearerAuth: [] }],
		paths: {
			'/auth/login': {
				post: {
					tags: ['Auth'],
					security: [],
					summary: 'Login',
					requestBody: {
						required: true,
						content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
					},
					responses: {
						'200': {
							description: 'OK',
							content: {
								'application/json': {
									schema: {
										allOf: [{ $ref: '#/components/schemas/SuccessEnvelope' }],
										properties: { data: { $ref: '#/components/schemas/LoginResponse' } }
									}
								}
							}
						},
						'401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } }
					}
				}
			},
			'/users/me': {
				get: {
					tags: ['Users'],
					summary: 'Get current user',
					responses: {
						'200': {
							description: 'OK',
							content: {
								'application/json': {
									schema: {
										allOf: [{ $ref: '#/components/schemas/SuccessEnvelope' }],
										properties: { data: { $ref: '#/components/schemas/User' } }
									}
								}
							}
						},
						'401': { description: 'Unauthorized' }
					}
				}
			},
			'/users': {
				get: {
					tags: ['Users'],
					summary: 'List users (admin)',
					parameters: [{ in: 'query', name: 'role', schema: { $ref: '#/components/schemas/Role' } }],
					responses: { '200': { description: 'OK' }, '403': { description: 'Forbidden' } }
				}
			},
			'/vendors': {
				get: { tags: ['Vendors'], summary: 'List vendors', responses: { '200': { description: 'OK' } } },
				post: {
					tags: ['Vendors'],
					summary: 'Create vendor (admin)',
					requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Vendor' } } } },
					responses: { '201': { description: 'Created' }, '403': { description: 'Forbidden' } }
				}
			},
			'/vendors/{id}': {
				parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
				put: {
					tags: ['Vendors'],
					summary: 'Update vendor (admin)',
					requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Vendor' } } } },
					responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } }
				},
				delete: { tags: ['Vendors'], summary: 'Delete vendor (admin)', responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } }
			},
			'/products': {
				get: { tags: ['Products'], summary: 'List products', responses: { '200': { description: 'OK' } } },
				post: {
					tags: ['Products'],
					summary: 'Create product (admin)',
					requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
					responses: { '201': { description: 'Created' } }
				}
			},
			'/products/{id}': {
				parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
				put: {
					tags: ['Products'],
					summary: 'Update product (admin)',
					requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
					responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } }
				},
				delete: { tags: ['Products'], summary: 'Delete product (admin)', responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } } }
			},
			'/orders': {
				get: { tags: ['Orders'], summary: 'List orders (role-scoped)', responses: { '200': { description: 'OK' } } },
				post: {
					tags: ['Orders'],
					summary: 'Create order (admin|practitioner)',
					requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrderRequest' } } } },
					responses: { '201': { description: 'Created' }, '400': { description: 'Bad Request' } }
				}
			},
			'/orders/{id}': {
				get: {
					tags: ['Orders'],
					summary: 'Get order with items',
					parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
					responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' }, '403': { description: 'Forbidden' } }
				}
			},
			'/orders/{id}/state': {
				patch: {
					tags: ['Orders'],
					summary: 'Update order state (admin|practitioner)',
					parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
					requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrderStateRequest' } } } },
					responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' }, '403': { description: 'Forbidden' } }
				}
			},
			'/orders/{id}/mark-paid': {
				post: {
					tags: ['Orders'],
					summary: 'Dev: mark order as paid (admin|practitioner)',
					parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
					responses: { '200': { description: 'OK' }, '403': { description: 'Forbidden' } }
				}
			},
			'/commissions': {
				get: { tags: ['Commissions'], summary: 'List commissions (admin or own for practitioner)', responses: { '200': { description: 'OK' }, '403': { description: 'Forbidden' } } }
			},
			'/commissions/{id}': {
				patch: {
					tags: ['Commissions'],
					summary: 'Set commission payout status (admin)',
					parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: { payoutStatus: { type: 'string', enum: ['PENDING', 'PAID'] } },
									required: ['payoutStatus'],
								},
							},
						},
					},
					responses: { '200': { description: 'OK' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' } },
				},
			},
			'/payments/checkout': {
				post: {
					tags: ['Payments'],
					summary: 'Create checkout session',
					requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckoutRequest' } } } },
					responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } }
				}
			},
			'/payments/webhook': {
				post: {
					tags: ['Payments'],
					security: [],
					summary: 'Stripe webhook (or mock)',
					responses: { '200': { description: 'Received' }, '400': { description: 'Bad Request' } }
				}
			},
			'/lab/results': {
				get: { tags: ['Lab'], summary: 'List lab results (role-scoped)', responses: { '200': { description: 'OK' }, '403': { description: 'Forbidden' } } }
			},
			'/lab/results/webhook': {
				post: {
					tags: ['Lab'],
					security: [],
					summary: 'Receive lab results',
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: { orderId: { type: 'string', format: 'uuid' }, resultUrl: { type: 'string' }, summary: { type: 'string' } },
									required: ['orderId', 'resultUrl']
								}
							}
						}
					},
					responses: { '200': { description: 'Received' }, '400': { description: 'Bad Request' } }
				}
			}
		}
	};
}

function setupSwagger(app) {
	const spec = buildSpec();
	app.get('/api/openapi.json', (_req, res) => res.json(spec));
	app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));
}

module.exports = { setupSwagger, buildSpec };

