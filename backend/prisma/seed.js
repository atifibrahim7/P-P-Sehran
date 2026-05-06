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
		const practitioner = await tx.practitioner.create({ data: { userId: practitionerUser.id } });

		const patientUser = await tx.user.create({
			data: {
				email: 'patient@sys.local',
				name: 'John Doe',
				password: hash('patient123'),
				role: 'PATIENT',
			},
		});
		await tx.patient.create({ data: { userId: patientUser.id, practitionerId: practitioner.id } });

		const labVendor = await tx.vendor.create({
			data: { name: 'Acme Labs', type: 'LAB' },
		});
		const suppVendor = await tx.vendor.create({
			data: { name: 'NutriSupp', type: 'SUPPLEMENT' },
		});

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
