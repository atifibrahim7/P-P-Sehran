-- Standalone patient carts: optional practitioner on Cart, new scope PATIENT_DIRECT
ALTER TABLE `Cart` MODIFY `practitionerId` INTEGER NULL;
ALTER TABLE `Cart` MODIFY `scope` ENUM('SELF', 'PATIENT', 'PATIENT_DIRECT') NOT NULL;
