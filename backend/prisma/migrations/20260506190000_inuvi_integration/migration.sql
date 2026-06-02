-- Inuvi order linkage + practitioner profile + product exam type

ALTER TABLE `Order` ADD COLUMN `inuviOrderId` VARCHAR(36) NULL,
    ADD COLUMN `inuviSyncError` TEXT NULL,
    ADD COLUMN `inuviSyncedAt` DATETIME(3) NULL;

ALTER TABLE `Product` ADD COLUMN `inuviExamTypeId` INTEGER NULL;

ALTER TABLE `Practitioner`
    ADD COLUMN `title` VARCHAR(10) NULL,
    ADD COLUMN `forenames` VARCHAR(100) NULL,
    ADD COLUMN `surname` VARCHAR(100) NULL,
    ADD COLUMN `dateOfBirth` DATE NULL,
    ADD COLUMN `gender` ENUM('UNKNOWN', 'MALE', 'FEMALE') NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `policyNumber` VARCHAR(100) NULL,
    ADD COLUMN `clientReference2` VARCHAR(100) NULL,
    ADD COLUMN `nationalInsuranceNumber` VARCHAR(50) NULL,
    ADD COLUMN `smokerStatus` ENUM('UNKNOWN', 'NON_SMOKER', 'SMOKER') NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `Practitioner_policyNumber_key` ON `Practitioner`(`policyNumber`);

CREATE TABLE `PractitionerAddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `practitionerId` INTEGER NOT NULL,
    `addressTypeId` INTEGER NOT NULL,
    `addressLine1` VARCHAR(255) NOT NULL,
    `addressLine2` VARCHAR(255) NULL,
    `addressLine3` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `county` VARCHAR(100) NULL,
    `country` VARCHAR(100) NOT NULL,
    `postcode` VARCHAR(20) NOT NULL,
    `isPreferred` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PractitionerContact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `practitionerId` INTEGER NOT NULL,
    `phoneNumber` VARCHAR(20) NOT NULL,
    `phoneType` ENUM('MOBILE', 'HOME', 'WORK', 'OTHER') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `PractitionerAddress_practitionerId_idx` ON `PractitionerAddress`(`practitionerId`);
CREATE INDEX `PractitionerContact_practitionerId_idx` ON `PractitionerContact`(`practitionerId`);

ALTER TABLE `PractitionerAddress` ADD CONSTRAINT `PractitionerAddress_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `Practitioner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PractitionerContact` ADD CONSTRAINT `PractitionerContact_practitionerId_fkey` FOREIGN KEY (`practitionerId`) REFERENCES `Practitioner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
