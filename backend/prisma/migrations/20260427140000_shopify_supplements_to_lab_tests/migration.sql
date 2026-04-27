UPDATE `Product` AS p
CROSS JOIN (
  SELECT `id` FROM `Vendor` WHERE `type` IN ('LAB', 'BOTH') ORDER BY `id` ASC LIMIT 1
) AS lab
SET p.`category` = 'BLOOD_TEST', p.`vendorId` = lab.`id`
WHERE p.`category` = 'SUPPLEMENT' AND p.`shopifyHandle` IS NOT NULL;
