-- reportUrl was a bare String (MySQL default VARCHAR(191)), silently truncating longer Cloudinary
-- URLs (naming-convention filenames embed clinic name + policy + names + timestamp, easily >191 chars).
-- InuviDocument.url already uses VarChar(1024); match it here.
ALTER TABLE `TestResult` MODIFY `reportUrl` VARCHAR(1024) NOT NULL;
