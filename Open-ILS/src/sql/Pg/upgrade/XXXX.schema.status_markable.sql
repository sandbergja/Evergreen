BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

ALTER TABLE config.copy_status
  ADD COLUMN markable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT status_cannot_be_markable CHECK (NOT markable OR id NOT IN (1, 6, 8, 9, 15));

COMMIT;
