-- Report approval workflow: extend TestResult with approval tracking

-- Backfill before tightening the status column to an ENUM (existing rows are free-text 'received')
UPDATE `TestResult` SET `status` = 'UPLOADED';

ALTER TABLE `TestResult`
  MODIFY `status` ENUM('UPLOADED', 'APPROVED') NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN `approvedAt` DATETIME(3) NULL,
  ADD COLUMN `approvedByPractitionerId` INTEGER NULL,
  ADD COLUMN `contactRequestedAt` DATETIME(3) NULL;

CREATE INDEX `TestResult_approvedByPractitionerId_idx` ON `TestResult`(`approvedByPractitionerId`);

ALTER TABLE `TestResult` ADD CONSTRAINT `TestResult_approvedByPractitionerId_fkey`
  FOREIGN KEY (`approvedByPractitionerId`) REFERENCES `Practitioner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: this FK (and every other FK/PK/unique/index declared across prior migrations) was initially
-- missing from the live database entirely - this host's tables had columns but no keys/indexes at all,
-- likely from a data-only restore during a hosting migration where `prisma migrate resolve --applied`
-- was used to mark history as applied without the DDL ever running. Restored separately; see repo notes.
