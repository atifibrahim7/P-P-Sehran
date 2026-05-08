require('dotenv/config');
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function main() {
	const existing = await prisma.user.count();
	if (existing > 0) {
		console.log('Seed skipped: users already exist.');
		return;
	}

	const hash = (p) => bcrypt.hashSync(p, 10);

	await prisma.$transaction(async (tx) => {
		const admin = await tx.user.create({
			data: {
				email: 'admin@sys.local',
				name: 'System Admin',
				password: hash('admin123'),
				role: 'ADMIN',
			},
		});

		const practitionerUser = await tx.user.create({
			data: {
				email: 'practitioner@sys.local',
				name: 'Dr. Smith',
				password: hash('prac123'),
				role: 'PRACTITIONER',
			},
		});
		const practitioner = await tx.practitioner.create({
			data: {
				userId: practitionerUser.id,
				title: 'Dr',
				forenames: 'Jane',
				surname: 'Smith',
				dateOfBirth: new Date('1985-06-15T00:00:00.000Z'),
				gender: 'FEMALE',
				policyNumber: 'PRAC-SEED-001',
				smokerStatus: 'NON_SMOKER',
			},
		});
		await tx.practitionerAddress.create({
			data: {
				practitionerId: practitioner.id,
				addressTypeId: 0,
				addressLine1: '10 Seed Street',
				city: 'London',
				country: 'United Kingdom',
				postcode: 'EC1A 1BB',
				isPreferred: true,
			},
		});
		await tx.practitionerContact.create({
			data: {
				practitionerId: practitioner.id,
				phoneNumber: '+447700900000',
				phoneType: 'MOBILE',
			},
		});

		const patientUser = await tx.user.create({
			data: {
				email: 'patient@sys.local',
				name: 'John Doe',
				password: hash('patient123'),
				role: 'PATIENT',
			},
		});
		const patient = await tx.patient.create({
			data: {
				userId: patientUser.id,
				practitionerId: practitioner.id,
				title: 'Mr',
				forenames: 'John',
				surname: 'Doe',
				dateOfBirth: new Date('1992-03-20T00:00:00.000Z'),
				gender: 'MALE',
				policyNumber: 'PAT-SEED-001',
				smokerStatus: 'UNKNOWN',
			},
		});
		await tx.address.create({
			data: {
				patientId: patient.id,
				addressTypeId: 0,
				addressLine1: '20 Patient Road',
				city: 'Manchester',
				country: 'United Kingdom',
				postcode: 'M1 1AE',
				isPreferred: true,
			},
		});
		await tx.contact.create({
			data: {
				patientId: patient.id,
				phoneNumber: '+447700900001',
				phoneType: 'MOBILE',
			},
		});

		const labVendor = await tx.vendor.create({
			data: { name: 'Acme Labs', type: 'LAB' },
		});
		const suppVendor = await tx.vendor.create({
			data: { name: 'NutriSupp', type: 'SUPPLEMENT' },
		});

		const defaultExam =
			Number.parseInt(process.env.INUVI_DEFAULT_EXAM_TYPE_ID || '1', 10) || 1;

		await tx.product.createMany({
			data: [
				{
					name: 'Complete Blood Count',
					description: 'A basic panel to evaluate overall blood health.',
					labTestCode: 'LAB-CBC-001',
					category: 'BLOOD_TEST',
					vendorId: labVendor.id,
					patientPrice: 60,
					practitionerPrice: 60,
					imageUrl: null,
					inuviExamTypeId: defaultExam,
				},
				{
					name: 'Vitamin D Supplement 2000IU',
					description: 'Daily vitamin D support for bone and immune health.',
					labTestCode: 'SUP-VITD-001',
					category: 'SUPPLEMENT',
					vendorId: suppVendor.id,
					patientPrice: 25,
					practitionerPrice: 25,
					imageUrl: null,
				},
			],
		});

		console.log('Seeded users:', { admin: admin.email, practitioner: practitionerUser.email, patient: patientUser.email });
	});
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
