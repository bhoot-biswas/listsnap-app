-- The server works through jobs itself, so a closed tab no longer stops them. A demo job's
-- visitor is counted by the salted hash of their address, kept here because the server has
-- no request to read it from (real shops have none: they have only their own limits). The
-- index finds the jobs still at work without reading every job.

ALTER TABLE `jobs` ADD COLUMN IF NOT EXISTS `visitor_key` CHAR(64) NULL AFTER `batch_id`;
ALTER TABLE `batches` ADD COLUMN IF NOT EXISTS `visitor_key` CHAR(64) NULL AFTER `video_media_id`;
ALTER TABLE `jobs` ADD INDEX IF NOT EXISTS `jobs_status_created_idx` (`status`, `created_at`);
ALTER TABLE `batches` ADD INDEX IF NOT EXISTS `batches_created_idx` (`created_at`);
