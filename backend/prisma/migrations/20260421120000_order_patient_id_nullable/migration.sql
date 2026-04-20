-- Practitioner self-orders have no patient; Prisma schema uses patientId optional.
ALTER TABLE `Order` MODIFY `patientId` INTEGER NULL;
