-- Shopify import trace fields (optional)
ALTER TABLE `Product` ADD COLUMN `shopifyHandle` VARCHAR(255) NULL;
ALTER TABLE `Product` ADD COLUMN `shopifyProductId` VARCHAR(64) NULL;
ALTER TABLE `Product` ADD COLUMN `shopifyVariantId` VARCHAR(64) NULL;
