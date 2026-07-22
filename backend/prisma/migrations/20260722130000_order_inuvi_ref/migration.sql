-- Inuvi's own order reference (MssRefNumber on their order object, e.g. "0000652404") was
-- never captured - only their internal order UUID was. Report filenames uploaded by the lab
-- embed this reference as InuviRef, and without it stored on Order there was no way to
-- disambiguate when a customer has more than one order awaiting a report.
ALTER TABLE `Order` ADD COLUMN `inuviRef` VARCHAR(20) NULL;
