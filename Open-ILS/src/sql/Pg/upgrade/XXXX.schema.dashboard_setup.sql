BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

CREATE SCHEMA IF NOT EXISTS dashboard;

-- Create a table for storing widget configurations
-- This table stores complete JSON widget configurations for dynamic dashboard rendering
DROP TABLE IF EXISTS dashboard.widgets CASCADE;
CREATE TABLE dashboard.widgets
(
    -- Widget identifier (unique code)
    code            TEXT PRIMARY KEY,

    -- Display name (localized)
    name            TEXT      NOT NULL,

    -- Widget category (circulations, acquisitions, cataloging, patrons, holdings)
    category        TEXT      NOT NULL,

    -- Complete JSON widget configuration (WidgetJsonConfig)
    json_config     JSONB     NOT NULL,

    -- Description of what the widget displays
    description     TEXT,

    -- Is this widget enabled/available?
    enabled         BOOLEAN   NOT NULL DEFAULT TRUE,

    -- Required permission to view this widget (NULL = no permission required)
    view_permission TEXT,

    -- Created/modified timestamps
    created         TIMESTAMP NOT NULL DEFAULT NOW(),
    modified        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on category for efficient filtering
CREATE INDEX dashboard_widgets_category_idx ON dashboard.widgets (category);

-- Create index on enabled for filtering active widgets
CREATE INDEX dashboard_widgets_enabled_idx ON dashboard.widgets (enabled);

-- Create table for user widget preferences
DROP TABLE IF EXISTS dashboard.user_widgets CASCADE;
CREATE TABLE dashboard.user_widgets
(
    id             SERIAL PRIMARY KEY,

    -- User ID
    usr            INTEGER   NOT NULL REFERENCES actor.usr (id) ON DELETE CASCADE,

    -- Widget code
    widget_code    TEXT      NOT NULL REFERENCES dashboard.widgets (code) ON DELETE CASCADE,

    -- Display order (for sorting)
    display_order  INTEGER   NOT NULL DEFAULT 0,

    -- Widget-specific customizations (e.g., date range, filters)
    customizations JSONB,

    -- Timestamps
    created        TIMESTAMP NOT NULL DEFAULT NOW(),
    modified       TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Each user can only have one instance of each widget
    UNIQUE (usr, widget_code)
);

-- Create index for efficient user widget lookup
CREATE INDEX dashboard_user_widgets_usr_idx ON dashboard.user_widgets (usr);

-- Insert default widget configurations
INSERT INTO dashboard.widgets (code, name, category, description, json_config, enabled)
VALUES ('current-holds-metric',
        oils_i18n_gettext(
                'current-holds-metric',
                'Current Holds',
                'dashboard_widget', 'label'
        ),
        'circulations',
        'Displays current count of active holds',
        '{
          "id": "current-holds-metric",
          "name": "Current Holds",
          "type": "metric",
          "category": "circulations",
          "dataSource": {
            "service": "circulation",
            "method": "getCurrentHoldsCount",
            "params": {
              "include_descendants": true
            },
            "cache": {
              "enabled": true,
              "ttl": 60
            }
          },
          "transform": {
            "type": "sum",
            "yField": "active"
          },
          "visualization": {
            "chartType": "metric",
            "title": "Current Holds",
            "icon": "bookmark",
            "color": "primary",
            "metricOptions": {
              "format": "number",
              "precision": 0
            }
          }
        }'::jsonb,
        TRUE),
       ('daily_circulation',
        oils_i18n_gettext(
                'daily_circulation',
                'Circulation Per Day',
                'dashboard_widget', 'label'
        ),
        'circulations',
        'Shows daily circulation counts over time',
        '{
          "id": "daily_circulation",
          "name": "Circulation Per Day",
          "type": "chart",
          "category": "circulations",
          "dataSource": {
            "service": "circulation",
            "method": "getCirculationTrend",
            "params": {
              "timeRange": "month",
              "include_descendants": true
            },
            "cache": {
              "enabled": true,
              "ttl": 300
            }
          },
          "transform": {
            "type": "groupBy",
            "xField": "date",
            "yField": "total",
            "groupByField": "date",
            "aggregation": "sum"
          },
          "visualization": {
            "chartType": "line",
            "title": "Daily Circulation",
            "xAxisLabel": "Date",
            "yAxisLabel": "Checkouts",
            "showGrid": true,
            "showTooltip": true
          }
        }'::jsonb,
        TRUE),
       ('circulation-by-location',
        oils_i18n_gettext(
                'circulation-by-location',
                'Circulation by Shelving Location',
                'dashboard_widget', 'label'
        ),
        'circulations',
        'Shows circulation statistics grouped by shelving location',
        '{
          "id": "circulation-by-location",
          "name": "Circulation by Location",
          "type": "chart",
          "category": "circulations",
          "dataSource": {
            "service": "circulation",
            "method": "getCirculationByShelvingLocation",
            "params": {
              "timeRange": "month",
              "include_descendants": true
            },
            "cache": {
              "enabled": true,
              "ttl": 300
            }
          },
          "transform": {
            "type": "groupBy",
            "xField": "shelving_location_name",
            "yField": "checkouts",
            "groupByField": "shelving_location",
            "aggregation": "sum",
            "sortBy": {
              "field": "checkouts",
              "order": "desc"
            },
            "limit": 10
          },
          "visualization": {
            "chartType": "bar",
            "title": "Top 10 Locations by Circulation",
            "xAxisLabel": "Shelving Location",
            "yAxisLabel": "Checkouts",
            "colors": [
              "#0d6efd"
            ]
          }
        }'::jsonb,
        TRUE),
       ('items-by-copy-status',
        oils_i18n_gettext(
                'items-by-copy-status',
                'Items by Copy Status',
                'dashboard_widget', 'label'
        ),
        'circulations',
        'Pie chart showing items distribution by copy status (Available, Checked Out, In Transit, etc.)',
        '{
          "id": "items-by-copy-status",
          "name": "Items by Copy Status",
          "type": "chart",
          "category": "circulations",
          "dataSource": {
            "service": "circulation",
            "method": "getItemsByCopyStatus",
            "params": {
              "include_descendants": true
            },
            "cache": {
              "enabled": true,
              "ttl": 300
            }
          },
          "transform": {
            "type": "sort",
            "xField": "copy_status_name",
            "yField": "count",
            "sortBy": {
              "field": "count",
              "order": "desc"
            }
          },
          "visualization": {
            "chartType": "pie",
            "title": "Items by Copy Status",
            "subtitle": "Current item distribution",
            "showLegend": true,
            "showTooltip": true,
            "colors": [
              "#198754",
              "#0d6efd",
              "#0dcaf0",
              "#ffc107",
              "#dc3545",
              "#6c757d",
              "#d63384",
              "#fd7e14"
            ]
          }
        }'::jsonb,
        TRUE),
       ('circulation-by-library',
        oils_i18n_gettext(
                'circulation-by-library',
                'Circulation by Library',
                'dashboard_widget', 'label'
        ),
        'circulations',
        'Pie chart showing circulation distribution across libraries/branches',
        '{
          "id": "circulation-by-library",
          "name": "Circulation by Library",
          "type": "chart",
          "category": "circulations",
          "dataSource": {
            "service": "circulation",
            "method": "getCirculationByLibrary",
            "params": {
              "timeRange": "month",
              "org_unit": 1,
              "include_descendants": true
            },
            "cache": {
              "enabled": true,
              "ttl": 300
            }
          },
          "transform": {
            "type": "sort",
            "xField": "library_name",
            "yField": "total",
            "sortBy": {
              "field": "total",
              "order": "desc"
            }
          },
          "visualization": {
            "chartType": "pie",
            "title": "Circulation by Library",
            "subtitle": "Last 30 days",
            "showLegend": true,
            "showTooltip": true,
            "colors": [
              "#0d6efd",
              "#198754",
              "#ffc107",
              "#dc3545",
              "#6f42c1",
              "#0dcaf0",
              "#fd7e14",
              "#d63384"
            ]
          }
        }'::jsonb,
        TRUE),
       ('items-by-status-and-library',
        oils_i18n_gettext(
                'items-by-status-and-library',
                'Collection Status by Library',
                'dashboard_widget', 'label'
        ),
        'circulations',
        'Stacked bar chart showing item status distribution across libraries (multi-series)',
        '{
          "id": "items-by-status-and-library",
          "name": "Collection Status by Library",
          "type": "chart",
          "category": "circulations",
          "dataSource": {
            "service": "circulation",
            "method": "getItemsByCopyStatusAndLibrary",
            "params": {
              "org_unit": 1,
              "include_descendants": true
            },
            "cache": {
              "enabled": true,
              "ttl": 300
            }
          },
          "transform": {
            "type": "multiSeries",
            "xField": "library",
            "yField": "item_count",
            "seriesField": "copy_status",
            "aggregation": "sum"
          },
          "visualization": {
            "chartType": "bar",
            "title": "Collection Status by Library",
            "subtitle": "Current item status across all branches",
            "xAxisLabel": "Library",
            "yAxisLabel": "Item Count",
            "showLegend": true,
            "showTooltip": true,
            "showGrid": true,
            "barStyle": {
              "grouping": "stacked"
            },
            "colors": [
              "#198754",
              "#0d6efd",
              "#dc3545",
              "#ffc107",
              "#6c757d",
              "#0dcaf0",
              "#fd7e14",
              "#d63384"
            ]
          }
        }'::jsonb,
        TRUE)
;


CREATE OR REPLACE VIEW dashboard.daily_circulation AS
SELECT DATE_TRUNC('day', ac.create_time)                                               AS date,
       ac.circ_lib,
       COUNT(DISTINCT ac.id),
       ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('day', ac.create_time), ac.circ_lib ASC) AS id
FROM action.circulation ac
GROUP BY 1, 2;

CREATE OR REPLACE VIEW dashboard.item_statuses AS
SELECT COUNT(DISTINCT acp.id)                                        AS count,
       acp.status                                                    AS status,
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
            ( (datatype = 'link' AND fm_class IS NOT NULL) OR
              (datatype <> 'link' AND fm_class IS NULL) OR
            -- arrays may or may not be of fieldmapper values. When they are we can do fun stuff in the gui
              (datatype = 'array') );

-- Test another array that seems like it should have a multi-select usable since it's picking a particular fm_class
-- Might delete later idk
UPDATE config.org_unit_setting_type
SET fm_class='ccs'
WHERE name = 'circ.selfcheck.block_checkout_on_copy_status';

-- Org unit setting for org-level widget defaults
-- This controls which widgets are available to users at each org unit
DELETE
FROM config.org_unit_setting_type
WHERE name = 'ui.dashboard.default_widgets';

INSERT INTO config.org_unit_setting_type (name, label, grp, description, datatype, fm_class, view_perm, update_perm)
VALUES ('ui.dashboard.default_widgets', --name
        oils_i18n_gettext( --label
                'ui.dashboard.default_widgets',
                'Default Dashboard Widgets',
                'coust', 'label'),
        'gui', --grp
        oils_i18n_gettext( --description
                'ui.dashboard.default_widgets',
                'JSON array of widget codes that should be displayed by default for users at this org unit. Users can override this by customizing their dashboard. Example: ["current-holds-metric", "daily_circulation", "circulation-by-location"]',
                'coust', 'description'
        ),
        'array', --datatype
           -- NULL,
        'dwdgt', --fm_class. Allows pretty tree in library settings editor
        NULL, --view_perm
        NULL --update_perm
       );


-- Set default widgets for the consortium (org_unit 1)
-- These will be inherited by child org units unless overridden
INSERT INTO actor.org_unit_setting (org_unit, name, value)
VALUES (1,
        'ui.dashboard.default_widgets',
        '["current-holds-metric", "daily_circulation", "circulation-by-location", "items-by-copy-status", "circulation-by-library", "items-by-status-and-library"]')
ON CONFLICT (org_unit, name) DO UPDATE
    SET value = EXCLUDED.value;


COMMIT;
