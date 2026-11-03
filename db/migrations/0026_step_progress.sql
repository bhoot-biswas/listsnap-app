-- What a step has already done outside, saved before the part that can't be undone: the
-- Facebook video or Instagram container a post was made with. A retry reads it and finishes
-- that post instead of making a second one.
ALTER TABLE `job_steps` ADD COLUMN IF NOT EXISTS `progress_json` JSON NULL AFTER `result_json`;
