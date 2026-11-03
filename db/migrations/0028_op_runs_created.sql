-- The nightly cleanup deletes op runs by age; without this it read the whole table to find them.
ALTER TABLE `op_runs` ADD INDEX IF NOT EXISTS `op_runs_created_idx` (`created_at`);
