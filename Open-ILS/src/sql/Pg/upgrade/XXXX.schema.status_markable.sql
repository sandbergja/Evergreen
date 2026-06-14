BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

ALTER TABLE config.copy_status
  ADD COLUMN markable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT status_cannot_be_markable CHECK (NOT markable OR id NOT IN (1, 6, 8, 9, 15));

-- Maintain backwards-compatible behavior: grid actions can
-- include "Mark as missing", "Mark as discard/weed", and
-- "Mark as damaged".
UPDATE config.copy_status
  SET markable = TRUE
  WHERE id IN (
    4, -- missing
    13, -- discard/weed
    14 -- damaged
  );

INSERT INTO permission.perm_list ( id, code, description ) VALUES
( 695, 'MARK_ITEM', oils_i18n_gettext(694,
     'Mark item as a configured status', 'ppl', 'description'));

COMMIT;
