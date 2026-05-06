-- AlterTable
ALTER TABLE `Patient`
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
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Backfill legacy Patient rows so new NOT NULL constraints are safe
UPDATE `Patient` p
JOIN `User` u ON u.`id` = p.`userId`
SET
  p.`forenames` = COALESCE(NULLIF(TRIM(SUBSTRING_INDEX(u.`name`, ' ', 1)), ''), 'Unknown'),
  p.`surname` = COALESCE(NULLIF(TRIM(SUBSTRING(u.`name`, CHAR_LENGTH(SUBSTRING_INDEX(u.`name`, ' ', 1)) + 2)), ''), 'Unknown'),
  p.`dateOfBirth` = COALESCE(p.`dateOfBirth`, '1900-01-01'),
  p.`policyNumber` = COALESCE(p.`policyNumber`, CONCAT('LEGACY-', p.`id`)),
  p.`updatedAt` = CURRENT_TIMESTAMP(3);

-- Apply final required constraints
ALTER TABLE `Patient`
  MODIFY `forenames` VARCHAR(100) NOT NULL,
  MODIFY `surname` VARCHAR(100) NOT NULL,
  MODIFY `dateOfBirth` DATE NOT NULL,
  MODIFY `policyNumber` VARCHAR(100) NOT NULL;

-- CreateTable
CREATE TABLE `Address` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `patientId` INTEGER NOT NULL,
  `addressTypeId` INTEGER NOT NULL,
  `addressLine1` VARCHAR(255) NOT NULL,
  `addressLine2` VARCHAR(255) NULL,
  `addressLine3` VARCHAR(255) NULL,
  `city` VARCHAR(100) NOT NULL,
  `county` VARCHAR(100) NULL,
  `country` VARCHAR(100) NOT NULL,
  `postcode` VARCHAR(20) NOT NULL,
  `isPreferred` BOOLEAN NOT NULL DEFAULT false,
  `preferredPatientId` INTEGER GENERATED ALWAYS AS (CASE WHEN `isPreferred` THEN `patientId` ELSE NULL END) VIRTUAL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Address_preferredPatientId_key`(`preferredPatientId`),
  INDEX `Address_patientId_idx`(`patientId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `patientId` INTEGER NOT NULL,
  `phoneNumber` VARCHAR(20) NOT NULL,
  `phoneType` ENUM('MOBILE', 'HOME', 'WORK', 'OTHER') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `Contact_patientId_idx`(`patientId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Patient_policyNumber_key` ON `Patient`(`policyNumber`);

-- AddForeignKey
ALTER TABLE `Address` ADD CONSTRAINT `Address_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
