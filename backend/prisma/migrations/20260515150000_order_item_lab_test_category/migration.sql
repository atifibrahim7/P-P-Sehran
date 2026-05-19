ALTER TABLE `OrderItem`
    ADD COLUMN `labTestCategory` ENUM('HOME_KIT', 'LAB_VISIT', 'PHLEBOTOMY') NULL AFTER `quantity`;