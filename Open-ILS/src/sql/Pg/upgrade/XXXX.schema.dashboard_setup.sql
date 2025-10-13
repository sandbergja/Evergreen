BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

CREATE SCHEMA IF NOT EXISTS dashboard;

-- Create a table for holding the names of all the widgets
DROP TABLE IF EXISTS dashboard.widgets;
CREATE TABLE dashboard.widgets (
    -- id SERIAL PRIMARY KEY,
    -- The official name to display for the user
    name text NOT NULL,
    -- The locale independent code to use for readable back end stuff
    code text PRIMARY KEY
);
INSERT INTO dashboard.widgets (code, name) VALUES
    (
        'daily_circulation',
        oils_i18n_gettext(
            'daily_circulation',
            'Circulation Per Day',
            'dashboard_widget', 'label'
        )
    ),
    (
        'item_status',
        oils_i18n_gettext(
            'item_status',
            'Collection Item Status',
            'dashboard_widget', 'label'
        )
    )
;


CREATE OR REPLACE VIEW dashboard.daily_circulation AS
SELECT
    DATE_TRUNC('day', ac.create_time) AS date, 
    ac.circ_lib,
    COUNT(DISTINCT ac.id),
    ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('day', ac.create_time), ac.circ_lib ASC) AS id
FROM action.circulation ac
GROUP BY 1, 2;

CREATE OR REPLACE VIEW dashboard.item_statuses AS
SELECT 
    COUNT(DISTINCT acp.id) AS count, 
    acp.status AS status, 
    acp.circ_lib,
    ROW_NUMBER() OVER (ORDER BY acp.circ_lib ASC, acp.status ASC) AS id
FROM asset.copy acp
WHERE NOT acp.deleted
GROUP BY acp.status, acp.circ_lib;

-- Change the org unit setting type table so that arrays may have an fm_class, if they want.
ALTER TABLE config.org_unit_setting_type
DROP CONSTRAINT IF EXISTS coust_no_empty_link;
ALTER TABLE config.org_unit_setting_type
ADD CONSTRAINT coust_no_empty_link 
    CHECK
    ( ( datatype = 'link' AND fm_class IS NOT NULL ) OR
      ( datatype <> 'link' AND fm_class IS NULL ) OR
      -- arrays may or may not be of fieldmapper values. When they are we can do fun stuff in the gui
      (datatype = 'array') );

-- Test another array that seems like it should have a multi-select usable since it's picking a particular fm_class
-- Might delete later idk
UPDATE config.org_unit_setting_type
SET fm_class='ccs'
WHERE name = 'circ.selfcheck.block_checkout_on_copy_status';

DELETE FROM config.org_unit_setting_type WHERE name = 'ui.dashboard.show_widgets';
INSERT INTO config.org_unit_setting_type (name, label, grp, description, datatype, fm_class, view_perm, update_perm)
VALUES (
    'ui.dashboard.show_widgets',    --name
    oils_i18n_gettext(              --label
        'ui.dashboard.show_widgets',
        'Shown Dashboard Widgets List',
        'cwst', 'label'),
    'gui',                          --grp
    oils_i18n_gettext(              --description
        'ui.dashboard.show_widgets',
        'The set of ui elements to include on the dashboard. All elements not included will be hidden.',
        'cwst', 'description'
    ),
    'array',                        --datatype
    'dashboard_widget',             --fm_class
    NULL,                           --view_perm
    NULL                            --update_perm
);


COMMIT;
