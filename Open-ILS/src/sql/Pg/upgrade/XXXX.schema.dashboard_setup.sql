BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

CREATE SCHEMA IF NOT EXISTS dashboard;

-- Create a table for storing widget configurations
-- This table stores complete JSON widget configurations for dynamic dashboard rendering
DROP TABLE IF EXISTS dashboard.widget CASCADE;
CREATE TABLE dashboard.widget
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
CREATE INDEX dashboard_widget_category_idx ON dashboard.widget (category);

-- Create index on enabled for filtering active widgets
CREATE INDEX dashboard_widget_enabled_idx ON dashboard.widget (enabled);

-- Create table for user widget preferences
DROP TABLE IF EXISTS dashboard.user_widget CASCADE;
CREATE TABLE dashboard.user_widget
(
    id             SERIAL PRIMARY KEY,

    -- User ID
    usr            INTEGER   NOT NULL REFERENCES actor.usr (id) ON DELETE CASCADE,

    -- Widget code
    widget_code    TEXT      NOT NULL REFERENCES dashboard.widget (code) ON DELETE CASCADE,

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
CREATE INDEX dashboard_user_widget_usr_idx ON dashboard.user_widget (usr);

-- Production Widget: Circulation by Patron Profile
-- This widget is ONLY possible with Blake's materialized table (profile dimension)
INSERT INTO dashboard.widget (code, name, category, description, json_config, enabled)
VALUES (
    'circulation-by-patron-profile',
    'Circulation by Patron Type',
    'circulations',
    'Shows circulation activity grouped by patron profile (Student, Faculty, Public, etc.). Only possible with materialized table.',
    '{
        "id": "circulation-by-patron-profile",
        "name": "Circulation by Patron Type",
        "type": "chart",
        "category": "circulations",
        "dataSource": {
            "service": "dashboard",
            "method": "getWidgetData",
            "params": {
                "timeRange": "month",
                "include_descendants": true
            },
            "query": {
                "table": "dashboard.materialized_action_all_circulation",
                "dimensions": ["profile"],
                "metrics": ["total"],
                "aggregation": "sum",
                "filters": {
                    "circ_lib": "$org_descendants",
                    "year": "$current_year",
                    "month": "$month_range"
                },
                "lookups": {
                    "profile": {
                        "table": "permission.grp_tree",
                        "keyField": "id",
                        "nameField": "name",
                        "outputField": "profile_name"
                    }
                },
                "sort": {
                    "field": "total",
                    "order": "desc"
                }
            },
            "cache": {
                "enabled": true,
                "ttl": 300
            }
        },
        "transform": {
            "type": "sort",
            "xField": "profile_name",
            "yField": "total",
            "sortBy": {
                "field": "total",
                "order": "desc"
            }
        },
        "visualization": {
            "chartType": "bar",
            "title": "Circulation by Patron Type",
            "subtitle": "Last 30 days",
            "xAxisLabel": "Patron Type",
            "yAxisLabel": "Checkouts",
            "showGrid": true,
            "colors": ["#6f42c1", "#0d6efd", "#198754", "#ffc107", "#dc3545"]
        }
    }'::jsonb,
    TRUE
);

-- Add NEW widget definitions with unified query structure
INSERT INTO dashboard.widget (code, name, category, description, json_config, enabled)
VALUES
-- Widget 1: Circulation by Library
('circulation-by-library',
 'Circulation by Library',
 'circulations',
 'Pie chart showing circulation distribution across libraries/branches',
 '{
   "id": "circulation-by-library",
   "name": "Circulation by Library",
   "type": "chart",
   "category": "circulations",
   "dataSource": {
     "service": "dashboard",
     "method": "getWidgetData",
     "params": {
       "timeRange": "month",
       "include_descendants": true
     },
     "query": {
       "table": "dashboard.materialized_action_all_circulation",
       "dimensions": ["circ_lib"],
       "metrics": ["total"],
       "aggregation": "sum",
       "filters": {
         "circ_lib": "$org_descendants",
         "year": "$current_year",
         "month": "$month_range"
       },
       "lookups": {
         "circ_lib": {
           "table": "actor.org_unit",
           "keyField": "id",
           "nameField": "name",
           "outputField": "library_name"
         }
       },
       "sort": {
         "field": "total",
         "order": "desc"
       }
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
     "colors": ["#0d6efd", "#198754", "#ffc107", "#dc3545", "#6f42c1", "#0dcaf0", "#fd7e14", "#d63384"]
   }
 }'::jsonb,
 TRUE),

-- Widget 2: Circulation by Shelving Location
('circulation-by-location',
 'Circulation by Shelving Location',
 'circulations',
 'Top 10 shelving locations by circulation activity',
 '{
   "id": "circulation-by-location",
   "name": "Circulation by Location",
   "type": "chart",
   "category": "circulations",
   "dataSource": {
     "service": "dashboard",
     "method": "getWidgetData",
     "params": {
       "timeRange": "month",
       "include_descendants": true
     },
     "query": {
       "table": "dashboard.materialized_action_all_circulation",
       "dimensions": ["copy_location"],
       "metrics": ["total"],
       "aggregation": "sum",
       "filters": {
         "circ_lib": "$org_descendants",
         "year": "$current_year",
         "month": "$month_range"
       },
       "lookups": {
         "copy_location": {
           "table": "asset.copy_location",
           "keyField": "id",
           "nameField": "name",
           "outputField": "shelving_location_name"
         }
       },
       "sort": {
         "field": "total",
         "order": "desc"
       },
       "limit": 10
     },
     "cache": {
       "enabled": true,
       "ttl": 300
     }
   },
   "transform": {
     "type": "sort",
     "xField": "shelving_location_name",
     "yField": "total",
     "sortBy": {
       "field": "total",
       "order": "desc"
     }
   },
   "visualization": {
     "chartType": "bar",
     "title": "Top 10 Locations by Circulation",
     "xAxisLabel": "Shelving Location",
     "yAxisLabel": "Checkouts",
     "colors": ["#0d6efd"]
   }
 }'::jsonb,
 TRUE),

-- Widget 3: Daily Circulation Trend
('daily-circulation',
 'Daily Circulation Trend',
 'circulations',
 'Daily circulation counts over time',
 '{
   "id": "daily-circulation",
   "name": "Circulation Per Day",
   "type": "chart",
   "category": "circulations",
   "dataSource": {
     "service": "dashboard",
     "method": "getWidgetData",
     "params": {
       "timeRange": "month",
       "include_descendants": true
     },
     "query": {
       "table": "dashboard.materialized_action_all_circulation",
       "dimensions": ["year", "month", "day"],
       "metrics": ["total"],
       "aggregation": "sum",
       "filters": {
         "circ_lib": "$org_descendants",
         "year": "$current_year",
         "month": "$month_range"
       },
       "sort": {
         "field": "day",
         "order": "asc"
       }
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
 TRUE);

-- =============================================================================
-- HOLDS WIDGETS
-- =============================================================================

-- Widget: Holds by Status
INSERT INTO dashboard.widget (code, name, category, description, json_config, enabled)
VALUES (
    'holds-by-status',
    'Holds by Status',
    'holds',
    'Current holds grouped by status (New, Captured, Ready for Pickup, Fulfilled, Canceled, Suspended)',
    '{
      "id": "holds-by-status",
      "name": "Holds by Status",
      "type": "chart",
      "category": "holds",
      "dataSource": {
        "service": "dashboard",
        "method": "getWidgetData",
        "params": {
          "timeRange": "month",
          "include_descendants": true
        },
        "query": {
          "table": "dashboard.materialized_action_hold_request",
          "dimensions": ["hold_status"],
          "metrics": ["total"],
          "aggregation": "sum",
          "filters": {
            "pickup_lib": "$org_descendants",
            "year": "$current_year",
            "month": "$month_range"
          },
          "sort": {
            "field": "total",
            "order": "desc"
          }
        },
        "cache": {
          "enabled": true,
          "ttl": 300
        }
      },
      "transform": {
        "type": "sort",
        "xField": "hold_status",
        "yField": "total",
        "sortBy": {
          "field": "total",
          "order": "desc"
        }
      },
      "visualization": {
        "chartType": "bar",
        "title": "Holds by Status",
        "subtitle": "Last 30 days",
        "xAxisLabel": "Hold Status",
        "yAxisLabel": "Count",
        "colors": ["#0d6efd", "#198754", "#ffc107", "#dc3545", "#6f42c1", "#0dcaf0"]
      }
    }'::jsonb,
    TRUE
);

-- Widget: Holds by Pickup Library
INSERT INTO dashboard.widget (code, name, category, description, json_config, enabled)
VALUES (
    'holds-by-library',
    'Holds by Pickup Library',
    'holds',
    'Holds distribution across libraries/branches by pickup location',
    '{
      "id": "holds-by-library",
      "name": "Holds by Pickup Library",
      "type": "chart",
      "category": "holds",
      "dataSource": {
        "service": "dashboard",
        "method": "getWidgetData",
        "params": {
          "timeRange": "month",
          "include_descendants": true
        },
        "query": {
          "table": "dashboard.materialized_action_hold_request",
          "dimensions": ["pickup_lib"],
          "metrics": ["total"],
          "aggregation": "sum",
          "filters": {
            "pickup_lib": "$org_descendants",
            "year": "$current_year",
            "month": "$month_range"
          },
          "lookups": {
            "pickup_lib": {
              "table": "actor.org_unit",
              "keyField": "id",
              "nameField": "name",
              "outputField": "library_name"
            }
          },
          "sort": {
            "field": "total",
            "order": "desc"
          }
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
        "title": "Holds by Pickup Library",
        "subtitle": "Last 30 days",
        "showLegend": true,
        "showTooltip": true,
        "colors": ["#0d6efd", "#198754", "#ffc107", "#dc3545", "#6f42c1", "#0dcaf0", "#fd7e14", "#d63384"]
      }
    }'::jsonb,
    TRUE
);

-- Widget: Holds by Type
INSERT INTO dashboard.widget (code, name, category, description, json_config, enabled)
VALUES (
    'holds-by-type',
    'Holds by Type',
    'holds',
    'Holds grouped by type (Title, Volume, Copy, Part)',
    '{
      "id": "holds-by-type",
      "name": "Holds by Type",
      "type": "chart",
      "category": "holds",
      "dataSource": {
        "service": "dashboard",
        "method": "getWidgetData",
        "params": {
          "timeRange": "month",
          "include_descendants": true
        },
        "query": {
          "table": "dashboard.materialized_action_hold_request",
          "dimensions": ["hold_type"],
          "metrics": ["total"],
          "aggregation": "sum",
          "filters": {
            "pickup_lib": "$org_descendants",
            "year": "$current_year",
            "month": "$month_range"
          },
          "sort": {
            "field": "total",
            "order": "desc"
          }
        },
        "cache": {
          "enabled": true,
          "ttl": 300
        }
      },
      "transform": {
        "type": "sort",
        "xField": "hold_type",
        "yField": "total",
        "sortBy": {
          "field": "total",
          "order": "desc"
        }
      },
      "visualization": {
        "chartType": "bar",
        "title": "Holds by Type",
        "subtitle": "Last 30 days",
        "xAxisLabel": "Hold Type",
        "yAxisLabel": "Count",
        "colors": ["#6f42c1"]
      }
    }'::jsonb,
    TRUE
);

-- Widget: Daily New Holds Trend
INSERT INTO dashboard.widget (code, name, category, description, json_config, enabled)
VALUES (
    'daily-new-holds',
    'Daily New Holds',
    'holds',
    'Daily new holds trend over time',
    '{
      "id": "daily-new-holds",
      "name": "Daily New Holds",
      "type": "chart",
      "category": "holds",
      "dataSource": {
        "service": "dashboard",
        "method": "getWidgetData",
        "params": {
          "timeRange": "month",
          "include_descendants": true
        },
        "query": {
          "table": "dashboard.materialized_action_hold_request",
          "dimensions": ["year", "month", "day"],
          "metrics": ["total"],
          "aggregation": "sum",
          "filters": {
            "pickup_lib": "$org_descendants",
            "year": "$current_year",
            "month": "$month_range"
          },
          "sort": {
            "field": "day",
            "order": "asc"
          }
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
        "title": "Daily New Holds",
        "xAxisLabel": "Date",
        "yAxisLabel": "Holds Requested",
        "showGrid": true,
        "showTooltip": true,
        "colors": ["#dc3545"]
      }
    }'::jsonb,
    TRUE
);

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
        'dw', --fm_class. Allows pretty tree in library settings editor
        NULL, --view_perm
        NULL --update_perm
       );


-- Set default widgets for the consortium (org_unit 1)
-- These will be inherited by child org units unless overridden
INSERT INTO actor.org_unit_setting (org_unit, name, value)
VALUES (1,
        'ui.dashboard.default_widgets',
        '["circulation-by-patron-profile", "circulation-by-library", "circulation-by-location", "daily-circulation", "holds-by-status", "holds-by-library"]')
ON CONFLICT (org_unit, name) DO UPDATE
    SET value = EXCLUDED.value;

-- Allow branches/systems to Opt out of the dashboard data collection
INSERT into config.org_unit_setting_type
    (name, grp, label, description, datatype)
    VALUES (
        'lib.dashboard.opt_out',
        'lib',
        oils_i18n_gettext(
            'lib.dashboard.opt_out',
            'Opt out of the dashboard statistics',
            'coust',
            'label'
        ),
        oils_i18n_gettext(
            'lib.dashboard.opt_out',
            'When enabled this ORG will not be included in the dashboard statistics',
            'coust',
            'description'
        ),
        'bool'
    )
ON CONFLICT (name) DO NOTHING;

-- triggered table approach

-- All Circulation
DROP TABLE IF EXISTS dashboard.materialized_action_all_circulation;

CREATE TABLE dashboard.materialized_action_all_circulation (
    id              BIGSERIAL   PRIMARY KEY,
    day             INT         NOT NULL,
    month           INT         NOT NULL,
    year            INT         NOT NULL,
    circ_lib        INT         REFERENCES actor.org_unit (id),
    copy_location   INT         REFERENCES asset.copy_location (id),
    profile         INT         REFERENCES permission.grp_tree (id),
    is_renewal      BOOLEAN     NOT NULL DEFAULT FALSE,
    total          BIGINT      NOT NULL,
    create_date    TIMESTAMP WITH TIME ZONE    DEFAULT NOW(),
    edit_date      TIMESTAMP WITH TIME ZONE    DEFAULT NOW(),
    CONSTRAINT dmac_one_per_total UNIQUE (day, month, year, circ_lib, copy_location, profile, is_renewal)
);
-- index everything FOR SPEED
CREATE INDEX dashboard_materialized_action_all_circulation_day_idx ON dashboard.materialized_action_all_circulation (day);
CREATE INDEX dashboard_materialized_action_all_circulation_month_idx ON dashboard.materialized_action_all_circulation (month);
CREATE INDEX dashboard_materialized_action_all_circulation_year_idx ON dashboard.materialized_action_all_circulation (year);
CREATE INDEX dashboard_materialized_action_all_circulation_circ_lib_idx ON dashboard.materialized_action_all_circulation (circ_lib);
CREATE INDEX dashboard_materialized_action_all_circulation_copy_location_idx ON dashboard.materialized_action_all_circulation (copy_location);
CREATE INDEX dashboard_materialized_action_all_circulation_profile_idx ON dashboard.materialized_action_all_circulation (profile);
CREATE INDEX dashboard_materialized_action_all_circulation_is_renewal_idx ON dashboard.materialized_action_all_circulation (is_renewal);
CREATE INDEX dashboard_materialized_action_all_circulation_total_idx ON dashboard.materialized_action_all_circulation (total);

-- Holds
DROP TABLE IF EXISTS dashboard.materialized_action_hold_request;

CREATE TABLE dashboard.materialized_action_hold_request (
    id              BIGSERIAL   PRIMARY KEY,
    day             INT         NOT NULL,
    month           INT         NOT NULL,
    year            INT         NOT NULL,
    pickup_lib      INT         REFERENCES actor.org_unit (id),
    hold_status     TEXT        NOT NULL DEFAULT 'NEW',
    hold_type       TEXT        NOT NULL DEFAULT 'T',
    profile         INT         REFERENCES permission.grp_tree (id),
    total           BIGINT      NOT NULL,
    create_date     TIMESTAMP WITH TIME ZONE    DEFAULT NOW(),
    edit_date       TIMESTAMP WITH TIME ZONE    DEFAULT NOW(),
    CONSTRAINT dmahr_one_per_total UNIQUE (day, month, year, pickup_lib, hold_status, hold_type, profile)
);
-- index everything FOR SPEED
CREATE INDEX dashboard_mat_action_hold_request_day_idx ON dashboard.materialized_action_hold_request (day);
CREATE INDEX dashboard_mat_action_hold_request_month_idx ON dashboard.materialized_action_hold_request (month);
CREATE INDEX dashboard_mat_action_hold_request_year_idx ON dashboard.materialized_action_hold_request (year);
CREATE INDEX dashboard_mat_action_hold_request_pickup_lib_idx ON dashboard.materialized_action_hold_request (pickup_lib);
CREATE INDEX dashboard_mat_action_hold_request_hold_status_idx ON dashboard.materialized_action_hold_request (hold_status);
CREATE INDEX dashboard_mat_action_hold_request_hold_type_idx ON dashboard.materialized_action_hold_request (hold_type);
CREATE INDEX dashboard_mat_action_hold_request_profile_idx ON dashboard.materialized_action_hold_request (profile);
CREATE INDEX dashboard_mat_action_hold_request_total_idx ON dashboard.materialized_action_hold_request (total);

CREATE OR REPLACE FUNCTION action.stat_edit_date_change() RETURNS trigger AS $func$
BEGIN
NEW.edit_date = now();
RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Setup the trigger so that updated rows recieve edit_date = now()
CREATE TRIGGER dashboard_mat_all_circ_update_trigger
	BEFORE UPDATE ON dashboard.materialized_action_all_circulation
	FOR EACH ROW EXECUTE PROCEDURE action.stat_edit_date_change();

CREATE TRIGGER dashboard_mat_action_hold_request_update_trigger
	BEFORE UPDATE ON dashboard.materialized_action_hold_request
	FOR EACH ROW EXECUTE PROCEDURE action.stat_edit_date_change();

INSERT INTO config.global_flag(name, value, label, enabled)
SELECT 'dashboard.age_limit.action.all_circulation', '1 year', 'Amount of time to limit the dashboard data', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config.global_flag WHERE name='dashboard.age_limit.action.all_circulation');

INSERT INTO config.global_flag(name, value, label, enabled)
SELECT 'dashboard.age_limit.action.hold_request', '1 year', 'Amount of time to limit the dashboard holds data', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config.global_flag WHERE name='dashboard.age_limit.action.hold_request');

CREATE OR REPLACE FUNCTION dashboard.recalculate_stat_table (stat_table TEXT, org_unit BIGINT DEFAULT NULL) RETURNS BIGINT AS $f$
DECLARE
  source_schema               TEXT;
  source_table                TEXT;
  age_limit                   TEXT;
  opt_out_orgs                INT[];
  updatecount                 INT := 0;
  chunk                       INTERVAL := '1 month'::INTERVAL;
  source_tables               TEXT[] := ARRAY['action.all_circulation', 'action.hold_request'];
  date_column_name            TEXT[] := ARRAY['xact_start', 'request_time'];
  org_context_column_name     TEXT[] := ARRAY['circ_lib', 'pickup_lib'];
  table_array_pos             INT;
  q_template                  TEXT;
  q                           TEXT;
  extra_where_clause          TEXT := '';
  pointer_template            TEXT;
  pointer                     TEXT := '1000-01-01';
  offs                        TEXT;
  insert_count                BIGINT;
  insert_total                BIGINT := 0;
BEGIN

  source_schema := SPLIT_PART(REGEXP_REPLACE(stat_table, 'materialized_', '', 'g'), '_', 1);
  source_table := source_schema || $$.$$ || REGEXP_REPLACE(REPLACE(stat_table, source_schema ||'_', ''), '^.*?_(.*)', '\1', 'g');
  -- RAISE NOTICE 'table: "%"', source_table;

-- This function should exit unless the table is supported
  IF array_position(source_tables, source_table) IS NULL THEN
    RETURN insert_total;
  END IF;

  table_array_pos = array_position(source_tables, source_table);

  -- Get the global flag setting
  SELECT INTO age_limit value FROM config.global_flag WHERE name = 'dashboard.age_limit.'||source_table AND enabled;
  IF (NOT FOUND) OR (age_limit IS NULL) THEN
      age_limit := '2 years';
  END IF;

-- Figure out which orgs want to be exempt from the dashboard stats

    WITH orgs AS
    (
        SELECT b.org_unit "o"
        FROM
        actor.org_unit_setting b
        WHERE
        name='lib.dashboard.opt_out'
        AND value = 'true'
    )
    SELECT INTO opt_out_orgs (SELECT array_agg(id) FROM actor.org_unit_descendants("o")) "forgs" FROM orgs;

-- END Figure out which orgs want to be exempt from the dashboard stats

-- Figure out the pointer and minimum date
  CREATE TEMP TABLE point_temp_table (ptr TEXT);

  pointer_template := $query$INSERT INTO point_temp_table(ptr)
  SELECT MIN($query$ || source_table || $query$.$query$ || date_column_name[table_array_pos] || $query$::DATE)::TEXT FROM $query$ || source_table || $query$
  WHERE
  $query$ || date_column_name[table_array_pos] || $query$::DATE >= (now() - '$query$ || age_limit || $query$'::INTERVAL)
  AND $query$ || date_column_name[table_array_pos] || $query$::DATE > '!!!pointer!!!'::DATE$query$;

  IF org_unit IS NOT NULL THEN
  pointer_template := pointer_template || $query$
  AND $query$ || source_table || $query$.$query$ || org_context_column_name[table_array_pos] || $query$ IN(SELECT id FROM actor.org_unit_descendants($query$ || org_unit || $query$))$query$;
  END IF;

  IF opt_out_orgs IS NOT NULL AND CARDINALITY(opt_out_orgs) > 0 THEN
  pointer_template := pointer_template || $query$
  AND $query$ || org_context_column_name[table_array_pos] || $query$ != ANY('$query$ || opt_out_orgs::TEXT || $query$'::INT[])$query$;
  END IF;

  EXECUTE REGEXP_REPLACE(pointer_template, '!!!pointer!!!', pointer, 'g');
  SELECT INTO pointer ptr FROM point_temp_table;
  -- RAISE NOTICE 'pointer query: %', pointer_template;
  -- RAISE NOTICE 'lowest date: %', pointer;

-- END Figure out the pointer and minimum date

-- Figure out the specific table query template

  IF stat_table = 'materialized_action_all_circulation' THEN
    q_template := $query$

        INSERT INTO dashboard.materialized_action_all_circulation
        (day, month, year, circ_lib, copy_location, profile, is_renewal, total)
        SELECT
        DATE_PART('day', action.all_circulation.xact_start) AS "day",
        DATE_PART('month', action.all_circulation.xact_start) AS "month",
        DATE_PART('year', action.all_circulation.xact_start) AS "year",
        action.all_circulation.circ_lib AS "circ_lib",
        action.all_circulation.copy_location AS "copy_location",
        action.all_circulation.usr_profile AS "profile",
        action.all_circulation.parent_circ IS NOT NULL AS "is_renewal",
        count(*) AS "total"
        FROM
        action.all_circulation
        WHERE
        !!!!extra_where_clause!!!!
        GROUP BY 1,2,3,4,5,6,7
    $query$;

  ELSIF stat_table = 'materialized_action_hold_request' THEN
    q_template := $query$

        INSERT INTO dashboard.materialized_action_hold_request
        (day, month, year, pickup_lib, hold_status, hold_type, profile, total)
        SELECT
        DATE_PART('day', action.hold_request.request_time) AS "day",
        DATE_PART('month', action.hold_request.request_time) AS "month",
        DATE_PART('year', action.hold_request.request_time) AS "year",
        action.hold_request.pickup_lib AS "pickup_lib",
        CASE WHEN action.hold_request.cancel_time IS NOT NULL THEN 'CANCELED'
        WHEN action.hold_request.fulfillment_time IS NOT NULL THEN 'FULFILLED'
        WHEN action.hold_request.shelf_time IS NOT NULL THEN 'READY FOR PICKUP'
        WHEN action.hold_request.capture_time IS NOT NULL THEN 'CAPTURED'
        WHEN action.hold_request.frozen THEN 'SUSPENDED'
        ELSE 'NEW'
        END AS "hold_status",
        action.hold_request.hold_type AS "hold_type",
        au.profile AS "profile",
        count(*) AS "total"
        FROM
        action.hold_request
        JOIN actor.usr au ON (au.id=action.hold_request.usr)
        WHERE
        !!!!extra_where_clause!!!!
        GROUP BY 1,2,3,4,5,6,7

    $query$;
  END IF;

  extra_where_clause := $query$
    $query$ || source_table || $query$.$query$ || date_column_name[table_array_pos] || $query$::DATE >= now() - '$query$ || age_limit || $query$'::INTERVAL$query$;

  extra_where_clause := extra_where_clause || $query$
    AND $query$ || source_table || $query$.$query$ || date_column_name[table_array_pos] || $query$::DATE >= '!!!pointer!!!'::DATE AND $query$ || source_table || $query$.$query$ || date_column_name[table_array_pos] || $query$::DATE < '!!!offs!!!'::DATE$query$;

    IF org_unit IS NOT NULL THEN
      extra_where_clause := extra_where_clause || $query$
        AND $query$ || source_table || $query$.$query$ || org_context_column_name[table_array_pos] || $query$ IN(SELECT id FROM actor.org_unit_descendants($query$ || org_unit || $query$))$query$;
    END IF;

    IF opt_out_orgs IS NOT NULL AND CARDINALITY(opt_out_orgs) > 0 THEN
      extra_where_clause := extra_where_clause || $query$
        AND $query$ || source_table || $query$.$query$ || org_context_column_name[table_array_pos] || $query$ != ANY('$query$ || opt_out_orgs::TEXT || $query$'::INT[])$query$;
    END IF;

  q_template := REGEXP_REPLACE(q_template, $$!!!!extra_where_clause!!!!$$, extra_where_clause, $$g$$);

-- RAISE NOTICE 'Query Template: %', q_template;

-- END Figure out the specific table query template

  IF pointer IS NOT NULL THEN

    -- Only delete rows for this org_unit (and descendants) if we're only updating this org_unit
    IF org_unit IS NOT NULL THEN
        EXECUTE $query$
            DELETE FROM dashboard.$query$ || stat_table || $query$
            WHERE $query$ || org_context_column_name[table_array_pos] || $query$
            IN (SELECT id FROM actor.org_unit_descendants($query$ || org_unit || $query$))$query$;
    ELSE
    -- Otherwise truncate the table because we're recalculating the whole thing
        EXECUTE $query$TRUNCATE dashboard.$query$ || stat_table;
    END IF;

    LOOP
      offs := (pointer::DATE + chunk)::TEXT;
      q := REGEXP_REPLACE(q_template, '!!!pointer!!!', pointer,'g');
      q := REGEXP_REPLACE(q, '!!!offs!!!', offs,'g');
      -- RAISE NOTICE 'gathering range: % -> %', pointer, offs::DATE;

      -- Where the magic happens, the ultimate goal of the function: INSERT
      EXECUTE q;
      GET DIAGNOSTICS insert_count = row_count;
      -- RAISE NOTICE '% rows', insert_count;
      insert_total := insert_total + insert_count;

      pointer := offs;
      TRUNCATE point_temp_table;
      EXECUTE REGEXP_REPLACE(pointer_template, '!!!pointer!!!', pointer, 'g');
      SELECT INTO pointer ptr FROM point_temp_table;

      -- no more data, exit
      IF pointer IS NULL THEN EXIT; END IF;

    END LOOP;
  END IF;


  DROP TABLE point_temp_table;

  RETURN insert_total;
END;
$f$ LANGUAGE PLPGSQL;

CREATE OR REPLACE FUNCTION action.circulation_dashboard_update() RETURNS trigger AS $func$
DECLARE
opt_out_orgs  INT[];
profile_id    BIGINT;
updated_total INT;
BEGIN

-- Figure out which orgs want to be exempt from the dashboard stats
  WITH orgs AS
  (
      SELECT b.org_unit "o"
      FROM
      actor.org_unit_setting b
      WHERE
      name='lib.dashboard.opt_out'
      AND value = 'true'
  )
  SELECT INTO opt_out_orgs (SELECT array_agg(id) FROM actor.org_unit_descendants("o")) "forgs" FROM orgs;
-- END Figure out which orgs want to be exempt from the dashboard stats

-- If this is one of the exempt orgs, exit
  IF opt_out_orgs IS NOT NULL AND NEW.circ_lib = ANY(opt_out_orgs) THEN RETURN NEW; END IF;

  IF (TG_OP = 'DELETE')
    OR (TG_OP = 'INSERT')
    OR (TG_OP = 'UPDATE'
      AND (
        NEW.xact_start <> OLD.xact_start
        OR NEW.circ_lib <> OLD.circ_lib
        OR NEW.copy_location <> OLD.copy_location
        OR (NEW.parent_circ IS NULL) <> (OLD.parent_circ IS NULL)
      )
    )
  THEN
    -- We need the context user profile
    IF TG_TABLE_NAME = 'circulation' THEN
      SELECT INTO profile_id profile FROM actor.usr WHERE id = OLD.usr;
    ELSE
    -- aged circulation uses a different column name
      SELECT INTO profile_id profile FROM actor.usr WHERE id = OLD.usr_profile;
    END IF;

    -- subtract from the previous stat
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE') THEN
      UPDATE dashboard.materialized_action_all_circulation
      SET
      total = total - 1
      WHERE day = DATE_PART('day', OLD.xact_start)
      AND month = DATE_PART('month', OLD.xact_start)
      AND year = DATE_PART('year', OLD.xact_start)
      AND circ_lib = OLD.circ_lib
      AND copy_location = OLD.copy_location
      AND profile = profile_id
      AND is_renewal = (OLD.parent_circ IS NOT NULL)
      -- make sure we don't go negative
      AND total > 0;
      GET DIAGNOSTICS updated_total = row_count;
      -- RAISE NOTICE 'DECREMENTED: %', updated_total;
    END IF;

    IF (TG_OP = 'UPDATE') THEN

    -- We need the context user profile
      IF TG_TABLE_NAME = 'circulation' THEN
        SELECT INTO profile_id profile FROM actor.usr WHERE id = NEW.usr;
      ELSE
      -- aged circulation uses a different column name
        SELECT INTO profile_id profile FROM actor.usr WHERE id = NEW.usr_profile;
      END IF;

      -- Increase the total to the now stat
      UPDATE dashboard.materialized_action_all_circulation
      SET
      total = total + 1
      WHERE day = DATE_PART('day', NEW.xact_start)
      AND month = DATE_PART('month', NEW.xact_start)
      AND year = DATE_PART('year', NEW.xact_start)
      AND circ_lib = NEW.circ_lib
      AND copy_location = NEW.copy_location
      AND profile = profile_id
      AND is_renewal = (NEW.parent_circ IS NOT NULL);

      GET DIAGNOSTICS updated_total = row_count;
      -- The stat doesn't exist, let's make one
      IF updated_total = 0 THEN
        INSERT INTO dashboard.materialized_action_all_circulation
        (day, month, year, circ_lib, copy_location, profile, is_renewal, total)
        VALUES(
          DATE_PART('day', NEW.xact_start),
          DATE_PART('month', NEW.xact_start),
          DATE_PART('year', NEW.xact_start),
          NEW.circ_lib,
          NEW.copy_location,
          profile_id,
          (NEW.parent_circ IS NOT NULL),
          1 -- starting out with a total of 1 for this circ
        );
      END IF;
    END IF;
  END IF;

	RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION action.hold_request_dashboard_update() RETURNS trigger AS $func$
DECLARE
opt_out_orgs  INT[];
profile_id    BIGINT;
old_hold_status_text TEXT;
new_hold_status_text TEXT;
updated_total INT;
BEGIN

-- Figure out which orgs want to be exempt from the dashboard stats
  WITH orgs AS
  (
      SELECT b.org_unit "o"
      FROM
      actor.org_unit_setting b
      WHERE
      name='lib.dashboard.opt_out'
      AND value = 'true'
  )
  SELECT INTO opt_out_orgs (SELECT array_agg(id) FROM actor.org_unit_descendants("o")) "forgs" FROM orgs;
-- END Figure out which orgs want to be exempt from the dashboard stats

-- If this is one of the exempt orgs, exit
  IF opt_out_orgs IS NOT NULL AND NEW.circ_lib = ANY(opt_out_orgs) THEN RETURN NEW; END IF;

-- Figure out what the hold status text is for the old row and the new row
  old_hold_status_text :=
  CASE WHEN OLD.cancel_time IS NOT NULL THEN 'CANCELED'
  WHEN OLD.fulfillment_time IS NOT NULL THEN 'FULFILLED'
  WHEN OLD.shelf_time IS NOT NULL THEN 'READY FOR PICKUP'
  WHEN OLD.capture_time IS NOT NULL THEN 'CAPTURED'
  WHEN OLD.frozen THEN 'SUSPENDED'
  ELSE 'NEW'
  END;

  new_hold_status_text :=
  CASE WHEN NEW.cancel_time IS NOT NULL THEN 'CANCELED'
  WHEN NEW.fulfillment_time IS NOT NULL THEN 'FULFILLED'
  WHEN NEW.shelf_time IS NOT NULL THEN 'READY FOR PICKUP'
  WHEN NEW.capture_time IS NOT NULL THEN 'CAPTURED'
  WHEN NEW.frozen THEN 'SUSPENDED'
  ELSE 'NEW'
  END;

  IF (TG_OP = 'DELETE')
    OR (TG_OP = 'INSERT')
    OR (TG_OP = 'UPDATE'
      AND (
        NEW.xact_start <> OLD.request_time
        OR NEW.pickup_lib <> OLD.pickup_lib
        OR NEW.cancel_time <> OLD.cancel_time
        OR NEW.fulfillment_time <> OLD.fulfillment_time
        OR NEW.shelf_time <> OLD.shelf_time
        OR NEW.capture_time <> OLD.capture_time
        OR NEW.frozen <> OLD.frozen
        OR NEW.hold_type <> OLD.hold_type
        OR new_hold_status_text <> old_hold_status_text
      )
    )
  THEN
    -- We need the context user profile
    SELECT INTO profile_id profile FROM actor.usr WHERE id = OLD.usr;

    -- subtract from the previous stat
    IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE') THEN
      UPDATE dashboard.materialized_action_hold_request
      SET
      total = total - 1
      WHERE day = DATE_PART('day', OLD.request_time)
      AND month = DATE_PART('month', OLD.request_time)
      AND year = DATE_PART('year', OLD.request_time)
      AND pickup_lib = OLD.pickup_lib
      AND hold_status = old_hold_status_text
      AND hold_type = OLD.hold_type
      AND profile = profile_id
      -- make sure we don't go negative
      AND total > 0;
      GET DIAGNOSTICS updated_total = row_count;
      -- RAISE NOTICE 'DECREMENTED: %', updated_total;
    END IF;

    IF (TG_OP = 'UPDATE') THEN

      -- We need the context user profile
      SELECT INTO profile_id profile FROM actor.usr WHERE id = NEW.usr;

      -- Increase the total to the now stat
      UPDATE dashboard.materialized_action_hold_request
      SET
      total = total + 1
      WHERE day = DATE_PART('day', NEW.request_time)
      AND month = DATE_PART('month', NEW.request_time)
      AND year = DATE_PART('year', NEW.request_time)
      AND pickup_lib = NEW.pickup_lib
      AND hold_status = new_hold_status_text
      AND hold_type = NEW.hold_type
      AND profile = profile_id;

      GET DIAGNOSTICS updated_total = row_count;
      -- The stat doesn't exist, let's make one
      IF updated_total = 0 THEN
        INSERT INTO dashboard.materialized_action_hold_request
        (day, month, year, pickup_lib, hold_status, hold_type, profile, total)
        VALUES(
          DATE_PART('day', NEW.request_time),
          DATE_PART('month', NEW.request_time),
          DATE_PART('year', NEW.request_time),
          NEW.pickup_lib,
          new_hold_status_text,
          NEW.hold_type,
          profile_id,
          1 -- starting out with a total of 1 for this hold
        );
      END IF;
    END IF;
  END IF;

	RETURN NEW;
END;
$func$ LANGUAGE plpgsql;


-- trigger on action.circulation
DROP TRIGGER IF EXISTS action_circulation_dashboard_mat_table_update_trigger ON action.circulation;
CREATE TRIGGER action_circulation_dashboard_mat_table_update_trigger
	AFTER DELETE OR UPDATE OR INSERT ON action.circulation
	FOR EACH ROW EXECUTE PROCEDURE action.circulation_dashboard_update();

-- trigger on action.aged_circulation
DROP TRIGGER IF EXISTS action_aged_circulation_dashboard_mat_table_update_trigger ON action.aged_circulation;
CREATE TRIGGER action_aged_circulation_dashboard_mat_table_update_trigger
	AFTER DELETE OR UPDATE OR INSERT ON action.aged_circulation
	FOR EACH ROW EXECUTE PROCEDURE action.circulation_dashboard_update();

-- trigger on action.hold_request
DROP TRIGGER IF EXISTS action_hold_request_dashboard_mat_table_update_trigger ON action.hold_request;
CREATE TRIGGER action_hold_request_dashboard_mat_table_update_trigger
	AFTER DELETE OR UPDATE OR INSERT ON action.hold_request
	FOR EACH ROW EXECUTE PROCEDURE action.hold_request_dashboard_update();


CREATE OR REPLACE FUNCTION dashboard.get_stats(stat_table TEXT, columns TEXT[])
RETURNS TABLE (datas JSON)
AS
$func$
DECLARE
select_query  TEXT;
comma_columns TEXT;

BEGIN

comma_columns := REGEXP_REPLACE(ARRAY_TO_STRING(columns, $$,$$),$$'$$,$$$$,'g');

select_query := $query$SELECT row_to_json(t) ttable FROM (
  SELECT
  $query$ || comma_columns || $query$,SUM(total) AS "total"
  FROM
  dashboard.$query$||stat_table||$query$ ttable
  GROUP BY $query$||comma_columns || $query$ ) t $query$;

RETURN QUERY EXECUTE select_query;

END;
$func$ LANGUAGE plpgsql;


COMMIT;