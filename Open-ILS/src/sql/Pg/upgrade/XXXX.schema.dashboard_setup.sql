BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

CREATE SCHEMA IF NOT EXISTS dashboard;

-- DROP VIEW query.db_daily_circulation;
CREATE OR REPLACE VIEW dashboard.daily_circulation AS
SELECT
    DATE_TRUNC('day', ac.create_time) AS date, 
    ac.circ_lib,
    COUNT(DISTINCT ac.id),
    ROW_NUMBER() OVER (ORDER BY DATE_TRUNC('day', ac.create_time), ac.circ_lib ASC) AS id
FROM action.circulation ac
GROUP BY 1, 2;

CREATE OR REPLACE VIEW dashboard.item_statuses AS
SELECT COUNT(acp.id) AS count, acp.status AS status
FROM asset.copy acp
GROUP BY acp.status;


COMMIT;
