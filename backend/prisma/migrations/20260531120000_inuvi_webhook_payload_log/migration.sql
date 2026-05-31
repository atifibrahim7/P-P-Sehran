CREATE TABLE `InuviWebhookPayload` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activityCode` VARCHAR(16) NULL,
    `payload` JSON NOT NULL,

    INDEX `InuviWebhookPayload_receivedAt_idx`(`receivedAt`),
    INDEX `InuviWebhookPayload_activityCode_idx`(`activityCode`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;