-- Two more counts per visitor across all their demo shops: photos kept without becoming a
-- listing (chat attachments, the brand kit's shop photo) and reels, which take a minute of
-- the whole server each. Per-shop caps alone reset with every new demo shop.

ALTER TABLE `ip_daily` ADD COLUMN IF NOT EXISTS `uploads` INT NOT NULL DEFAULT 0 AFTER `ai_calls`;
ALTER TABLE `ip_daily` ADD COLUMN IF NOT EXISTS `reels` INT NOT NULL DEFAULT 0 AFTER `uploads`;
