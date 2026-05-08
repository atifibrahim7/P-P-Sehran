-- Soft delete columns for users and patients
ALTER TABLE `User`
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

ALTER TABLE `Patient`
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `User_deletedAt_idx` ON `User`(`deletedAt`);
CREATE INDEX `Patient_deletedAt_idx` ON `Patient`(`deletedAt`);
