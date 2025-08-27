BEGIN;

-- Create tables in the staging schema to hold self-registrations identified as spam
CREATE TABLE IF NOT EXISTS staging.spam_user_stage (LIKE staging.user_stage);
CREATE TABLE IF NOT EXISTS staging.spam_card_stage (LIKE staging.card_stage);
CREATE TABLE IF NOT EXISTS staging.spam_mailing_address_stage (LIKE staging.mailing_address_stage);
CREATE TABLE IF NOT EXISTS staging.spam_billing_address_stage (LIKE staging.billing_address_stage);
CREATE TABLE IF NOT EXISTS staging.spam_statcat_stage (LIKE staging.statcat_stage);
CREATE TABLE IF NOT EXISTS staging.spam_setting_stage (LIKE staging.setting_stage);
CREATE SEQUENCE staging.spam_user_stage_row_id_seq start with 1;
CREATE SEQUENCE staging.spam_mailing_address_stage_row_id_seq start with 1;

ALTER TABLE staging.spam_user_stage ALTER COLUMN row_id SET DEFAULT nextval('staging.spam_user_stage_row_id_seq');
ALTER TABLE staging.spam_mailing_address_stage ALTER COLUMN row_id SET DEFAULT nextval('staging.spam_mailing_address_stage_row_id_seq');
-- US is not a good default, but it makes it consistent with other tables in the staging schema
ALTER TABLE staging.spam_mailing_address_stage ALTER COLUMN country SET DEFAULT 'US';

-- Create training_spam* versions for basic training data of spam self-registrations
CREATE TABLE IF NOT EXISTS staging.training_spam_user_stage (LIKE staging.user_stage);
CREATE TABLE IF NOT EXISTS staging.training_spam_mailing_address_stage (LIKE staging.mailing_address_stage);

-- Create training* versions for basic training data of legitimate self-registrations
CREATE TABLE IF NOT EXISTS staging.training_user_stage (LIKE staging.user_stage);
CREATE TABLE IF NOT EXISTS staging.training_mailing_address_stage (LIKE staging.mailing_address_stage);

CREATE OR REPLACE FUNCTION staging.mark_as_spam(spam_row_id BIGINT) RETURNS VOID AS $$
DECLARE spam_usrname TEXT;
BEGIN
    SELECT usrname INTO spam_usrname FROM staging.user_stage WHERE row_id=spam_row_id;

    INSERT INTO staging.spam_mailing_address_stage SELECT * FROM staging.mailing_address_stage WHERE usrname=spam_usrname;
    DELETE FROM staging.mailing_address_stage WHERE usrname=spam_usrname;

    INSERT INTO staging.spam_billing_address_stage SELECT * FROM staging.billing_address_stage WHERE usrname=spam_usrname;
    DELETE FROM staging.billing_address_stage WHERE usrname=spam_usrname;

    INSERT INTO staging.spam_statcat_stage SELECT * FROM staging.statcat_stage WHERE usrname=spam_usrname;
    DELETE FROM staging.statcat_stage WHERE usrname=spam_usrname;

    INSERT INTO staging.spam_setting_stage SELECT * FROM staging.setting_stage WHERE usrname=spam_usrname;
    DELETE FROM staging.setting_stage WHERE usrname=spam_usrname;

    INSERT INTO staging.spam_card_stage SELECT * FROM staging.card_stage WHERE usrname=spam_usrname;
    DELETE FROM staging.card_stage WHERE usrname=spam_usrname;

    INSERT INTO staging.spam_user_stage SELECT * FROM staging.user_stage WHERE usrname=spam_usrname;
    DELETE FROM staging.user_stage WHERE usrname=spam_usrname;
END;
$$
LANGUAGE PLPGSQL
VOLATILE;

CREATE OR REPLACE FUNCTION staging.mark_as_not_spam(not_spam_row_id BIGINT) RETURNS VOID AS $$
DECLARE not_spam_usrname TEXT;
BEGIN
    SELECT usrname INTO not_spam_usrname FROM staging.spam_user_stage WHERE row_id=not_spam_row_id;

    INSERT INTO staging.mailing_address_stage SELECT * FROM staging.spam_mailing_address_stage WHERE usrname=not_spam_usrname;
    DELETE FROM staging.spam_mailing_address_stage WHERE usrname=not_spam_usrname;

    INSERT INTO staging.billing_address_stage SELECT * FROM staging.spam_billing_address_stage WHERE usrname=not_spam_usrname;
    DELETE FROM staging.spam_billing_address_stage WHERE usrname=not_spam_usrname;

    INSERT INTO staging.statcat_stage SELECT * FROM staging.spam_statcat_stage WHERE usrname=not_spam_usrname;
    DELETE FROM staging.spam_statcat_stage WHERE usrname=not_spam_usrname;

    INSERT INTO staging.setting_stage SELECT * FROM staging.spam_setting_stage WHERE usrname=not_spam_usrname;
    DELETE FROM staging.spam_setting_stage WHERE usrname=not_spam_usrname;

    INSERT INTO staging.card_stage SELECT * FROM staging.spam_card_stage WHERE usrname=not_spam_usrname;
    DELETE FROM staging.spam_card_stage WHERE usrname=not_spam_usrname;

    INSERT INTO staging.user_stage SELECT * FROM staging.spam_user_stage WHERE usrname=not_spam_usrname;
    DELETE FROM staging.spam_user_stage WHERE usrname=not_spam_usrname;
END;
$$
LANGUAGE PLPGSQL
VOLATILE;

CREATE OR REPLACE FUNCTION staging.spam_classifier_diagnostics(
    ) RETURNS stats.binary_classifier_diagnostic AS $$
DECLARE
    should_use_local_data             INT;
    train_test_query                  TEXT;
    train_test_results                stats.binary_classifier_train_test_result;
BEGIN
    SELECT COUNT(*) FROM config.global_flag WHERE name = 'opac.spam_filter.use_local_data' AND enabled INTO should_use_local_data;
    IF should_use_local_data THEN
        SELECT FORMAT(
            'SELECT * FROM stats.binary_classifier_train_and_test((%s ON stgu.usrname = stgma.usrname), (%s ON stgu.mailing_address = stgma.id))',
            staging.spam_feature_extraction_query('staging.spam_user_stage', 'staging.spam_mailing_address_stage'),
            staging.spam_feature_extraction_query('actor.usr', 'actor.usr_address'))
            INTO train_test_query;
    ELSE
        SELECT FORMAT(
            'SELECT * FROM stats.binary_classifier_train_and_test((%s ON stgu.usrname = stgma.usrname), (%s ON stgu.usrname = stgma.usrname))',
            staging.spam_feature_extraction_query('staging.training_spam_user_stage', 'staging.training_spam_mailing_address_stage'),
            staging.spam_feature_extraction_query('staging.training_user_stage', 'staging.training_mailing_address_stage'))
            INTO train_test_query;
    END IF;
    EXECUTE train_test_query INTO train_test_results;
    RETURN ROW(stats.binary_classifier_feature_importance((train_test_results).feature_probabilities_true, (train_test_results).feature_probabilities_false),
        (train_test_results).accuracy);
END;
$$
    LANGUAGE PLPGSQL
    VOLATILE;


CREATE OR REPLACE FUNCTION staging.spam_feature_extraction_query(
    user_table                TEXT, -- a table with a similar structure to staging.user_stage
    mailing_address_table     TEXT  -- a table with a similar structure to staging.mailing_address_stage
) RETURNS TEXT AS $$
DECLARE
    feature_extractors     TEXT;
BEGIN
    SELECT string_agg(
        format('COALESCE(REGEXP_COUNT(%s, %L), 0)', field, regular_expression),
        ', '
    ) INTO feature_extractors
    FROM config.spam_measurement;
    RETURN format('SELECT ARRAY_AGG(ARRAY[%s])
        FROM %s stgu
        INNER JOIN %s stgma',
        feature_extractors,
        user_table,
        mailing_address_table);
END;
$$ LANGUAGE PLPGSQL VOLATILE;

CREATE OR REPLACE FUNCTION staging.spam_likelihood(
    first_given_name            TEXT,
    second_given_name           TEXT,
    family_name                 TEXT,
    usrname                     TEXT,
    street1                     TEXT,
    city                        TEXT,
    post_code                   TEXT,
    -- US is not a good default, but it makes it consistent with other tables in the staging schema
    country                     TEXT default 'US'
) RETURNS NUMERIC AS $$
DECLARE
    row_id                      INTEGER;
    training_results            stats.binary_classifier_train_result;
    registration_to_check       INTEGER[];
BEGIN
    -- Train the classifier on the latest data and configured features
    EXECUTE format(
        'SELECT * FROM stats.binary_classifier_train((%s ON stgu.usrname = stgma.usrname), (%s ON stgu.usrname = stgma.usrname))',
        staging.spam_feature_extraction_query('staging.training_spam_user_stage', 'staging.training_spam_mailing_address_stage'),
        staging.spam_feature_extraction_query('staging.training_user_stage', 'staging.training_mailing_address_stage'))
        INTO training_results;

    row_id := FLOOR(RANDOM() * 1_000_000_000);
    -- Extract features from the new self-registration
    CREATE TEMPORARY TABLE IF NOT EXISTS _staging_usr (LIKE staging.user_stage) ON COMMIT DROP;
    CREATE TEMPORARY TABLE IF NOT EXISTS _staging_mailing_address (LIKE staging.mailing_address_stage) ON COMMIT DROP;
    INSERT INTO _staging_usr (row_id, first_given_name, second_given_name, family_name, usrname)
        VALUES (row_id, first_given_name, second_given_name, family_name, usrname);
    INSERT INTO _staging_mailing_address ( row_id, street1, city, post_code, country, usrname)
        VALUES (row_id, street1, city, post_code, COALESCE(country, 'US'), usrname);
    EXECUTE FORMAT('%s ON stgu.usrname = stgma.usrname WHERE stgu.row_id=%s AND stgma.row_id=%s', 
        staging.spam_feature_extraction_query('_staging_usr', '_staging_mailing_address'),
        row_id, row_id
    ) INTO registration_to_check;

    RETURN stats.binary_classifier_likelihood(
        evergreen.flatten_array(registration_to_check),
        (training_results).feature_probabilities_true,
        (training_results).feature_probabilities_false,
        (training_results).prior_probability
    );
END;
$$ LANGUAGE PLPGSQL VOLATILE;


COMMIT;
