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

-- Insert default widget configurations
INSERT INTO dashboard.widget (code, name, category, description, json_config, enabled)
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
        '["current-holds-metric", "daily_circulation", "circulation-by-location", "items-by-copy-status", "circulation-by-library", "items-by-status-and-library"]')
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
    );

-- triggered table approach

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

CREATE OR REPLACE FUNCTION action.stat_edit_date_change() RETURNS trigger AS $func$
BEGIN
NEW.edit_date = now();
RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Setup the trigger so that updated rows recieve edit_date = now()
CREATE TRIGGER dashboard_mat_table_update_trigger
	BEFORE UPDATE ON dashboard.materialized_action_all_circulation
	FOR EACH ROW EXECUTE PROCEDURE action.stat_edit_date_change();

INSERT INTO config.global_flag(name, value, label, enabled)
SELECT 'dashboard.age_limit.action.all_circulation', '1 year', 'Amount of time to limit the dashboard data', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config.global_flag WHERE name='dashboard.age_limit.action.all_circulation');

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
  org_context_column_name     TEXT[] := ARRAY['circ_lib', 'circ_lib', 'pickup_lib'];
  table_array_pos             INT;
  q_template                  TEXT;
  q                           TEXT;
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
  SELECT MIN($query$ || date_column_name[table_array_pos] || $query$::DATE)::TEXT FROM $query$ || source_table || $query$
  WHERE
  $query$ || date_column_name[table_array_pos] || $query$::DATE >= (now() - '$query$ || age_limit || $query$'::INTERVAL)
  AND $query$ || date_column_name[table_array_pos] || $query$::DATE > '!!!pointer!!!'::DATE$query$;

  IF org_unit IS NOT NULL THEN
  pointer_template := pointer_template || $query$
  AND $query$ || org_context_column_name[table_array_pos] || $query$ IN(SELECT id FROM actor.org_unit_descendants($query$ || org_unit || $query$))$query$;
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
        DATE_PART('day', acirc.xact_start) AS "day",
        DATE_PART('month', acirc.xact_start) AS "month",
        DATE_PART('year', acirc.xact_start) AS "year",
        acirc.circ_lib AS "circ_lib",
        acirc.copy_location AS "copy_location",
        acirc.usr_profile AS "profile",
        acirc.parent_circ IS NOT NULL AS "is_renewal",
        count(*) AS "total"
        FROM
        action.all_circulation acirc
        WHERE
        acirc.xact_start::DATE >= now() - '$query$ || age_limit || $query$'::INTERVAL
        AND acirc.xact_start::DATE >= '!!!pointer!!!'::DATE AND acirc.xact_start::DATE < '!!!offs!!!'::DATE$query$;

        IF org_unit IS NOT NULL THEN
        q_template := q_template || $query$
        AND acirc.circ_lib IN(SELECT id FROM actor.org_unit_descendants($query$ || org_unit || $query$))
        $query$;
        END IF;

        IF opt_out_orgs IS NOT NULL AND CARDINALITY(opt_out_orgs) > 0 THEN
        q_template := q_template || $query$
        AND acirc.circ_lib != ANY('$query$ || opt_out_orgs::TEXT || $query$'::INT[])
        $query$;
        END IF;

        q_template := q_template || $query$
        GROUP BY 1,2,3,4,5,6,7

    $query$;
  END IF;

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
existing_row  BIGINT := 0;
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


-- trigger on action.circulation
CREATE TRIGGER action_circulation_dashboard_mat_table_update_trigger
	AFTER DELETE OR UPDATE OR INSERT ON action.circulation
	FOR EACH ROW EXECUTE PROCEDURE action.circulation_dashboard_update();

-- trigger on action.aged_circulation
CREATE TRIGGER action_aged_circulation_dashboard_mat_table_update_trigger
	AFTER DELETE OR UPDATE OR INSERT ON action.aged_circulation
	FOR EACH ROW EXECUTE PROCEDURE action.circulation_dashboard_update();


COMMIT;