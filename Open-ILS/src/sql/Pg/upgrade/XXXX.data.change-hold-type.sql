BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('xxxx', :eg_version);

INSERT INTO action.hold_request_cancel_cause (id,label,manual) VALUES (11, oils_i18n_gettext(11, 'Replaced with another hold', 'ahrcc', 'label'), FALSE);

COMMIT;
