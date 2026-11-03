-- A bulk batch's Pause, kept on the server: the server works through batches by itself
-- (PIPELINE_WORKER), so a Pause only in the seller's tab would no longer stop anything.
ALTER TABLE `batches` ADD COLUMN IF NOT EXISTS `paused_at` TIMESTAMP(3) NULL AFTER `visitor_key`;
