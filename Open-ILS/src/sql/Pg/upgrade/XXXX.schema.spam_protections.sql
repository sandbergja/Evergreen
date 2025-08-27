BEGIN;

-- SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

DROP FUNCTION IF EXISTS permission.blocks_for_email_address; -- DELETE THIS LINE when finished with development!!!
DROP TABLE IF EXISTS permission.email_block_list; -- DELETE THIS LINE when finished with development!!!
DROP TABLE IF EXISTS config.spam_measurement; -- DELETE THIS LINE when finished with development!!!

-------------------------
-- Begin email blocking
-------------------------

DO $$ BEGIN
    CREATE TYPE permission.email_block_list_type AS ENUM ('email', 'domain');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


CREATE TABLE IF NOT EXISTS permission.email_block_list (
    id         SERIAL                             PRIMARY KEY,
    address    TEXT                               NOT NULL,
    type       permission.email_block_list_type   NOT NULL,
    edit_date  TIMESTAMP WITH TIME ZONE,
    editor     INT REFERENCES actor.usr (id)
               ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
    CONSTRAINT must_be_a_valid_email CHECK (type != 'email'::permission.email_block_list_type OR address LIKE '%@%')
);

CREATE INDEX IF NOT EXISTS email_block_list_address
    ON permission.email_block_list (address);

INSERT INTO permission.email_block_list (address, type) VALUES
    ('ottoortner@gmx.at', 'email'),
    ('163.com', 'domain'),
    ('agricole.fr', 'domain'),
    ('ameriterary.com', 'domain'),
    ('belocksmith.com', 'domain'),
    ('borroded.com', 'domain'),
    ('coupledglind.org.uk', 'domain'),
    ('i4dots.com', 'domain'),
    ('insuranus.com', 'domain'),
    ('ninternation.com', 'domain'),
    ('nobutu.org', 'domain'),
    ('paristorage.net', 'domain'),
    ('releanded.com', 'domain'),
    ('stristed.org', 'domain'),
    ('versarily.org', 'domain');

CREATE OR REPLACE FUNCTION permission.blocks_for_email_address(email TEXT) RETURNS SETOF permission.email_block_list AS $$
    SELECT * FROM permission.email_block_list
    -- Check if the email address matches the configured domain or one of its subdomains
    WHERE (email ~ ('.*@(.*\.)?' || address || '$') AND type = 'domain')
    OR (email = address AND type = 'email');
$$
    LANGUAGE SQL
    STABLE
    RETURNS NULL ON NULL INPUT;


-------------------------
-- End email blocking
-------------------------


-------------------------
-- Begin Spam measurements table and related
-------------------------

CREATE OR REPLACE FUNCTION evergreen.is_valid_regex(pattern TEXT) RETURNS BOOLEAN AS $$
BEGIN
    PERFORM '' ~ pattern;
    RETURN TRUE;
EXCEPTION
    WHEN others THEN
        RETURN FALSE;
END;
$$ LANGUAGE PLPGSQL IMMUTABLE;

CREATE OR REPLACE FUNCTION config.is_valid_spam_measurement_field(field TEXT) RETURNS BOOLEAN AS $$
-- Does not catch any possible invalid input (for example, you could provide a column name from an
-- invalid table), but it should be sufficient to prevent anything malicious.
SELECT field ~ '^(stgu|stgma)\.\w+' AND EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE column_name = SUBSTRING(field FROM POSITION('.' in field) + 1)
);
$$ LANGUAGE SQL VOLATILE;

CREATE TABLE IF NOT EXISTS config.spam_measurement (
    id                         SERIAL      PRIMARY KEY,
    field                      TEXT        NOT NULL,
    regular_expression         TEXT        NOT NULL,
    label                      TEXT        NOT NULL
    CONSTRAINT must_be_a_valid_field CHECK (config.is_valid_spam_measurement_field(field)),
    CONSTRAINT must_be_a_valid_regex CHECK (evergreen.is_valid_regex(regular_expression))
);

INSERT INTO config.spam_measurement (field, regular_expression, label) VALUES
    ('stgu.first_given_name', '[\$¢£ƒ֏؋¥৲৳৻૱௹฿៛\u20A0-\u20CF]', 'currency symbols in first name'),
    ('stgu.first_given_name', '[[:upper:]]', 'upper-case letters in first name'),
    ('stgu.first_given_name', '-', 'hyphen in first name'),
    ('stgu.first_given_name', '\s', 'spaces in first name'),
    ('stgu.first_given_name', '\byou\b', 'literal word you in first name'),
    ('stgu.first_given_name', '\bfor\b', 'literal word for in first name'),
    ('stgu.first_given_name', '\bthe\b', 'literal word for in first name'),
    ('stgu.second_given_name', '[\$¢£ƒ֏؋¥৲৳৻૱௹฿៛\u20A0-\u20CF]', 'currency symbols in second name'),
    ('stgu.second_given_name', '[[:upper:]]', 'upper-case letters in second name'),
    ('stgu.second_given_name', '!', 'exclamation mark in second name'),
    ('stgu.second_given_name', '\s', 'spaces in second name'),
    ('stgu.second_given_name', '\byou\b', 'literal word you in first name'),
    ('stgu.second_given_name', '\bfor\b', 'literal word for in first name'),
    ('stgu.second_given_name', '\bthe\b', 'literal word for in first name'),
    ('stgu.family_name', '[\$¢£ƒ֏؋¥৲৳৻૱௹฿៛\u20A0-\u20CF]', 'currency symbols in family name'),
    ('stgu.family_name', '[[:upper:]]', 'upper-case letters in family name'),
    ('stgu.family_name', '\s', 'spaces in the family name'),
    ('stgu.family_name', '\byou\b', 'literal word you in first name'),
    ('stgu.family_name', '\bfor\b', 'literal word for in first name'),
    ('stgu.family_name', '\bthe\b', 'literal word for in first name'),
    ('stgma.street1', '[[:digit:]]', 'digits in the street 1'),
    ('stgma.street1', '!', 'exclamation marks in the street 1'),
    ('stgma.street1', '\s', 'spaces in the street 1'),
    ('stgma.city', '\byou\b', 'literal word you in the street 1'),
    ('stgma.city', '\bfor\b', 'literal word for in the street 1'),
    ('stgma.street1', '[\$¢£ƒ֏؋¥৲৳৻૱௹฿៛\u20A0-\u20CF]', 'currency symbols in the street 1'),
    ('stgma.city', '[[:alpha:]]$', 'city ends with letter'),
    ('stgma.city', '\byou\b', 'literal word you in city'),
    ('stgma.city', '\bfor\b', 'literal word for in city'),
    ('stgma.post_code', '[[:digit:]]', 'digits in post code'),
    ('stgma.post_code', '[[:alpha:]]', 'letters in post code'),
    ('stgma.post_code', '[[:punct:]]', 'punctuation in post code'),
    ('stgma.post_code', '\byou\b', 'literal word you in post code'),
    ('stgma.post_code', '\bfor\b', 'literal word for in post code'),
    ('stgma.post_code', '\bthe\b', 'literal word for in post code');


-------------------------
-- End Spam measurements table and related
-------------------------


-----------------------------------------
-- Begin Tables to hold spam and training data
-----------------------------------------

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

-----------------------------------------
-- End Tables to hold spam and training data
-----------------------------------------

-----------------------------------------
-- Begin Naive Bayes classifier implementation
-----------------------------------------

DO $$ BEGIN
    CREATE TYPE stats.binary_classifier_testing_document AS (
        document                     INTEGER[],
        expected_result              BOOLEAN        
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stats.binary_classifier_training_and_test_data AS (
        true_documents_for_training  INTEGER[][],
        false_documents_for_training INTEGER[][],
        documents_for_testing        stats.binary_classifier_testing_document[]
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stats.binary_classifier_train_result AS (
        feature_probabilities_true   NUMERIC[],
        feature_probabilities_false  NUMERIC[],
        prior_probability            NUMERIC
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stats.binary_classifier_train_test_result AS (
        feature_probabilities_true   NUMERIC[],
        feature_probabilities_false  NUMERIC[],
        prior_probability            NUMERIC,
        accuracy                     NUMERIC
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stats.binary_classifier_diagnostic AS (
        feature_importance   NUMERIC[],
        accuracy             NUMERIC
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION stats.binary_classifier_likelihood(
    features_to_predict         INTEGER[],
    feature_probabilities_true  NUMERIC[],
    feature_probabilities_false NUMERIC[],
    prior_probability           NUMERIC
    ) RETURNS NUMERIC AS $$
DECLARE
    logarithmic_probability_true NUMERIC;
    logarithmic_probability_false NUMERIC;
BEGIN
    IF CARDINALITY(features_to_predict) != CARDINALITY(feature_probabilities_true) OR
        CARDINALITY(feature_probabilities_true) != CARDINALITY(feature_probabilities_false) THEN
        RAISE EXCEPTION 'All arrays must have the same cardinality';
    END IF;

    -- Use logarithms to reduce the impact of Arithmetic underflow.  We will convert them back to
    -- more typical probability percentages later.
    logarithmic_probability_true := LN(prior_probability);
    logarithmic_probability_false := LN(1-prior_probability);

    FOR i IN 1..CARDINALITY(features_to_predict) LOOP
        -- Add 1.0 in case the features_to_predict count is zero
        logarithmic_probability_true := logarithmic_probability_true + ((1.0+features_to_predict[i]) * LN(feature_probabilities_true[i]));
        logarithmic_probability_false := logarithmic_probability_false + ((1.0+features_to_predict[i]) * LN(feature_probabilities_false[i]));
    END LOOP;

    -- We're done with serious calculations, we can leave the logarithm world now.
    RETURN EXP(logarithmic_probability_true) / (EXP(logarithmic_probability_true) + EXP(logarithmic_probability_false));
END;
$$
    LANGUAGE PLPGSQL
    IMMUTABLE;

CREATE OR REPLACE FUNCTION evergreen.flatten_array(arr ANYARRAY) RETURNS ANYARRAY AS $$
    SELECT ARRAY(SELECT UNNEST(arr));
$$
    LANGUAGE SQL
    IMMUTABLE;


CREATE OR REPLACE FUNCTION stats.binary_classifier_train_and_test(
    true_documents  INTEGER[][],
    false_documents INTEGER[][]
    ) RETURNS stats.binary_classifier_train_test_result AS $$
DECLARE
    true_documents_for_training  INTEGER[][];
    false_documents_for_training INTEGER[][];
    documents_for_testing        stats.binary_classifier_testing_document[];
    training_results             stats.binary_classifier_train_result;
    prediction                   NUMERIC;
    accurate_prediction_count    INTEGER := 0;
BEGIN
    SELECT * FROM stats.binary_classifier_train_test_split(
        true_documents, false_documents
    ) INTO true_documents_for_training, false_documents_for_training, documents_for_testing;

    -- Training phase
    training_results := stats.binary_classifier_train(true_documents_for_training, false_documents_for_training);

    -- Testing phase
    FOR i IN 1..ARRAY_LENGTH(documents_for_testing, 1) LOOP
        prediction := stats.binary_classifier_likelihood(
            evergreen.flatten_array(documents_for_testing[i].document),
            (training_results).feature_probabilities_true,
            (training_results).feature_probabilities_false,
            (training_results).prior_probability);
        -- Did it correctly predict true?
        IF prediction >= 0.5 AND documents_for_testing[i].expected_result THEN
            accurate_prediction_count := accurate_prediction_count + 1;
        -- Did it correctly predict false?
        ELSIF prediction < 0.5 AND NOT documents_for_testing[i].expected_result THEN
            accurate_prediction_count := accurate_prediction_count + 1;
        END IF;
    END LOOP;

    RETURN ROW(
        (training_results).feature_probabilities_true,
        (training_results).feature_probabilities_false,
        (training_results).prior_probability,
        (accurate_prediction_count::numeric / ARRAY_LENGTH(documents_for_testing, 1))
    );
END;
$$
    LANGUAGE PLPGSQL
    VOLATILE;

CREATE OR REPLACE FUNCTION stats.binary_classifier_train(
    true_documents  INTEGER[][],
    false_documents INTEGER[][]
    ) RETURNS stats.binary_classifier_train_result AS $$
DECLARE
    true_document_count          BIGINT;
    false_document_count         BIGINT;
    all_document_count           BIGINT;

    number_of_features           INTEGER;
    true_feature_sums            INTEGER[];
    false_feature_sums           INTEGER[];
    true_denominator             BIGINT := 0;
    false_denominator            BIGINT := 0;

    feature_probabilities_true   NUMERIC[];
    feature_probabilities_false  NUMERIC[];
    prior_probability            NUMERIC;
BEGIN
    true_document_count := ARRAY_LENGTH(true_documents, 1);
    false_document_count := ARRAY_LENGTH(false_documents, 1);
    IF true_document_count < 1 OR false_document_count < 1 THEN
        RAISE EXCEPTION 'Arrays must not be empty';
    END IF;
    all_document_count := true_document_count + false_document_count;

    number_of_features := ARRAY_LENGTH(true_documents, 2);
    IF ARRAY_LENGTH(false_documents, 2) != number_of_features THEN
        RAISE EXCEPTION 'All documents must have the same number of features';
    END IF;

    -- Laplace smoothing: Add 1 to the numerator to prevent inadvertently ending up
    -- with a probability of 0
    true_feature_sums := ARRAY_FILL(1, ARRAY[number_of_features]);
    false_feature_sums := ARRAY_FILL(1, ARRAY[number_of_features]);
    true_denominator := number_of_features;
    false_denominator := number_of_features;

    FOR doc_id IN 1..ARRAY_LENGTH(true_documents, 1) LOOP
        FOR feature_id IN 1..number_of_features LOOP
            true_feature_sums[feature_id] := true_feature_sums[feature_id] + true_documents[doc_id][feature_id];
            true_denominator := true_denominator + true_documents[doc_id][feature_id];
        END LOOP;
    END LOOP;

    FOR doc_id IN 1..ARRAY_LENGTH(false_documents, 1) LOOP
        FOR feature_id IN 1..number_of_features LOOP
            false_feature_sums[feature_id] := false_feature_sums[feature_id] + false_documents[doc_id][feature_id];   
            false_denominator := false_denominator + false_documents[doc_id][feature_id];
        END LOOP;
    END LOOP;

    FOR feature_id IN 1..number_of_features LOOP
        feature_probabilities_true[feature_id] := true_feature_sums[feature_id] / true_denominator::numeric;
        feature_probabilities_false[feature_id] := false_feature_sums[feature_id] / false_denominator::numeric;
    END LOOP;

    prior_probability := ARRAY_LENGTH(true_documents, 1)::numeric / (ARRAY_LENGTH(true_documents, 1) + ARRAY_LENGTH(false_documents, 1));


    RETURN ROW(feature_probabilities_true, feature_probabilities_false, prior_probability);
END;
$$
    LANGUAGE PLPGSQL
    IMMUTABLE;

-- This function is quite slow on large arrays (say, 50,000 entries)
CREATE OR REPLACE FUNCTION stats.binary_classifier_train_test_split(
    true_documents  INTEGER[][],
    false_documents INTEGER[][]
    ) RETURNS stats.binary_classifier_training_and_test_data AS $$
DECLARE
    true_document_count         BIGINT;
    false_document_count        BIGINT;
    all_document_count          BIGINT;
    ids_for_test_phase          BIGINT[];

    true_documents_for_training  INTEGER[][];
    false_documents_for_training INTEGER[][];
    documents_for_testing        stats.binary_classifier_testing_document[];
BEGIN
    true_document_count := ARRAY_LENGTH(true_documents, 1);
    false_document_count := ARRAY_LENGTH(false_documents, 1);
    IF true_document_count < 1 OR false_document_count < 1 THEN
        RAISE EXCEPTION 'Arrays must not be empty';
    END IF;
    all_document_count := true_document_count + false_document_count;

    -- 20% of IDS will be added to documents_for_testing
    -- all others will go into *_documents_for_training
    -- This contains ids for both true_documents and
    -- false_documents, with the false_document IDs being
    -- (true_document_count) + actual_index_in_the_false_documents_array
    SELECT ARRAY_AGG(ids) INTO ids_for_test_phase
        FROM (SELECT DISTINCT floor(random() * all_document_count) + 1 AS ids
            FROM generate_series(1, all_document_count)
            LIMIT all_document_count*0.2);

    FOR doc_id IN 1..true_document_count LOOP
        IF doc_id = ANY(ids_for_test_phase) THEN
            documents_for_testing := documents_for_testing || (true_documents[doc_id:doc_id], TRUE)::stats.binary_classifier_testing_document;
        ELSE
            true_documents_for_training := true_documents_for_training || true_documents[doc_id:doc_id];
        END IF;
    END LOOP;

    FOR doc_id IN 1..false_document_count LOOP
        IF (doc_id + true_document_count) = ANY(ids_for_test_phase) THEN
            documents_for_testing := documents_for_testing || (false_documents[doc_id:doc_id], FALSE)::stats.binary_classifier_testing_document;
        ELSE
            false_documents_for_training := false_documents_for_training || false_documents[doc_id:doc_id];
        END IF;
    END LOOP;

    RETURN ROW(true_documents_for_training, false_documents_for_training, documents_for_testing);
END;
$$
    LANGUAGE PLPGSQL
    VOLATILE; -- this function is volatile because there is randomness in splitting test/train data


-- This function is in Perl since the PL/PGSQL implementation is a huge bottleneck on large datasets,
-- due to the iteration through large arrays.
-- Running this function with two arrays with cardinality of 1 million takes over 2 minutes in a
-- PL/PGSQL implementation, while it takes about 4 seconds in the following implementation
CREATE OR REPLACE FUNCTION stats.binary_classifier_train_test_split(
    true_documents  INTEGER[][],
    false_documents INTEGER[][]
    ) RETURNS stats.binary_classifier_training_and_test_data AS $$
    use strict;

    my ($true_documents, $false_documents) = @_;
    my $total_document_count = scalar(@{$true_documents}) + scalar(@{$false_documents});

    # Create a list of documents for our testing set (as a hash rather than array for faster lookup)
    my $desired_test_doc_count = $total_document_count * 0.2;
    my %ids_for_test_phase;
    while (keys(%ids_for_test_phase) < $desired_test_doc_count) {
        $ids_for_test_phase{int(rand($total_document_count))} = 1;
    }

    my @true_documents_for_training;
    my @false_documents_for_training;
    my @documents_for_testing;

    for (my $i = 0; $i < @{$true_documents}; $i++) {
        if (exists $ids_for_test_phase{$i}) {
            push @documents_for_testing, {document => $true_documents->[$i], expected_result => 1};
        } else {
            push @true_documents_for_training, $true_documents->[$i];
        }
    }

    for (my $i = 0; $i < @{$false_documents}; $i++) {
        if (exists $ids_for_test_phase{$i + @{$true_documents}}) {
            push @documents_for_testing, {document => $false_documents->[$i], expected_result => 0};
        } else {
            push @false_documents_for_training, $false_documents->[$i];
        }
    }

    return {
         true_documents_for_training => \@true_documents_for_training,
         false_documents_for_training => \@false_documents_for_training,
         documents_for_testing => \@documents_for_testing
    };
$$
    LANGUAGE PLPERLU
    VOLATILE; -- this function is volatile because there is randomness in splitting test/train data


CREATE OR REPLACE FUNCTION stats.binary_classifier_feature_importance(
    true_probabilities  NUMERIC[],
    false_probabilities NUMERIC[]
    ) RETURNS NUMERIC[] AS $$
DECLARE
    importance NUMERIC[];
BEGIN
    FOR feature_id IN 1..CARDINALITY(true_probabilities) LOOP
        importance := importance || ABS(LN(true_probabilities[feature_id]) - LN(false_probabilities[feature_id]));
    END LOOP;

    RETURN importance;
END;
$$
    LANGUAGE PLPGSQL
    IMMUTABLE;

-----------------------------------------
-- End Naive Bayes classifier implementation
-----------------------------------------

-----------------------------------------
-- Begin using Naive Bayes classifier for spam in the staging schema
-----------------------------------------

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
        VALUES (row_id, street1, city, post_code, country, usrname);
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

-----------------------------------------
-- End using Naive Bayes classifier for spam in the staging schema
-----------------------------------------

-----------------------------------------
-- Begin training data
-----------------------------------------

-- Spam messages are taken from three sources:
--    * The PaILS database
--    * Spam entries posted to https://bugs.launchpad.net/evergreen/+bug/1821093
--    * Spam entries from the UC Irvine SMS Spam Collection
--      (https://archive.ics.uci.edu/dataset/228/sms+spam+collection),
--      but with innappropriate messages according to my own subjective judgment

INSERT INTO staging.training_spam_user_stage(row_id, first_given_name, second_given_name, family_name, usrname) VALUES
(0, 'FrLTEOHUsFsocqh', 'RyckzTGmUWOW', 'ZGLNNdHGuD', 'SPAM-0'),
(1, 'zfoYpZiXyZWN', 'bxuuNGkcdZWo', 'ygppEZSnM', 'SPAM-1'),
(2, 'eiKPzwafrFSA', 'qlXTKcayueGq', 'gzDJJqnyPvBOZAj', 'SPAM-2'),
(3, 'fGvpDEScmOUhiJA', 'fhguTYYJbCwtmu', 'BgVCyZsW', 'SPAM-3'),
(4, 'kONRbxLUeafCMCN', 'WEqvvGVXDqeXuD', 'zegeyrvo', 'SPAM-4'),
(5, 'LizfMvMS', 'dMEOyyWHJSoDfNZ', 'EFyzhFrvnwc', 'SPAM-5'),
(6, 'eGqxPdGauDQqD', 'sCLSzzRU', 'KPzrZaxXWrBTsX', 'SPAM-6'),
(7, 'MYRdnWpLAKcJ', 'UanBZqfzfobYc', 'SQKwLmjqy', 'SPAM-7'),
(8, 'nKruyHutCpYATx', 'mLgwyGMeRXCD', 'vohGZiyel', 'SPAM-8'),
(9, 'njAamQFg', 'MRsOFOjKreYPAe', 'jwJDnIYrxPeiFB', 'SPAM-9'),
(10, 'ioZYSEthGpnaZXo', 'zKsSVteGkY', 'ZQHWwFqwlb', 'SPAM-10'),
(11, 'aILpjQGNy', 'psAUkGcoqbO', 'nOKTPDhGe', 'SPAM-11'),
(12, 'reKabCBqsMGm', 'kcjgNVoMjTOl', 'NZqVgIJBN', 'SPAM-12'),
(13, 'omXbxpBtpuj', 'mVThEKEgqfe', 'EtPvBVojnNOReeO', 'SPAM-13'),
(14, 'YMALmFHbZck', 'NbufImTqKBdZhj', 'hJUTnSiwOTcxJw', 'SPAM-14'),
(15, 'AjkRZcRyghk', 'KNwvKNBxZNOYpB', 'gLihOTCUZmqRO', 'SPAM-15'),
(16, 'dfyWWBtFdIS', 'gXOXsauLNKIbBej', 'HBmoLdyzlHp', 'SPAM-16'),
(17, 'CmaDdwLkKYbuEKy', 'itarbLdpJ', 'ZnJFtBBlp', 'SPAM-17'),
(18, 'NOZlOVKgSsW', 'tqNRFWwYmlV', 'JrBpmujlVx', 'SPAM-18'),
(19, 'lQzXDpdRQPyHI', 'QuEFQOBDR', 'MlpWyeqhrJqv', 'SPAM-19'),
(20, 'aqkgQNQDbeG', 'OEzeTHqfgtP', 'MzOdILgYQ', 'SPAM-20'),
(21, 'vnPiwdVfL', 'UODOLrJaA', 'pnsQQeesvTeWUgU', 'SPAM-21'),
(22, 'bfIPoDQU', 'bitotBqYERrQde', 'ixOZwjSbxoa', 'SPAM-22'),
(23, 'EhqIQGksvDEJ', 'uToywPzrigP', 'mGvuBMtTw', 'SPAM-23'),
(24, 'HeDVaQTD', 'GWtPhFDH', 'eHXJWOfs', 'SPAM-24'),
(25, 'iopWMMAEHvZS', 'uLOjRQvU', 'opeMffgJW', 'SPAM-25'),
(26, 'WqpRhdTBVCXhUT', 'oBLbxSBmWUj', 'kpHzuHXB', 'SPAM-26'),
(27, 'jkqNGJTYbg', 'wHZaPTxI', 'KjIRJeXw', 'SPAM-27'),
(28, 'FrLTEOHUsFsocqh', 'RyckzTGmUWOW', 'ZGLNNdHGuD', 'SPAM-28'),
(29, 'zfoYpZiXyZWN', 'bxuuNGkcdZWo', 'ygppEZSnM', 'SPAM-29'),
(30, 'jkqNGJTYbg', 'wHZaPTxI', 'KjIRJeXw', 'SPAM-30'),
(31, 'VcSRGcjTWYo', 'oqqpnzOpBv', 'RYUwsDET', 'SPAM-31'),
(32, 'How to invest in', 'How to invest in', 'How to invest in', 'SPAM-32'),
(33, 'How to earn on', 'How to earn on', 'How to earn on', 'SPAM-33'),
(34, 'What''s the most', 'What''s the most', 'What''s the most', 'SPAM-34'),
(35, 'How to earn on', 'How to earn on', 'How to earn on', 'SPAM-35'),
(36, 'How to get 0,75', 'How to get 0,75', 'How to get 0,75', 'SPAM-36'),
(37, 'Just how would', 'Just how would', 'Just how would', 'SPAM-37'),
(38, 'Paid Studies', 'Paid Studies', 'Paid Studies', 'SPAM-38'),
(39, 'Invest $ 7734', 'Invest $ 7734', 'Invest $ 7734', 'SPAM-39'),
(40, 'Paid Studies', 'Paid Studies', 'Paid Studies', 'SPAM-40'),
(41, 'What''s the easiest', 'What''s the easiest', 'What''s the easiest', 'SPAM-41'),
(42, 'ttOYOJpCo', 'qeeWqaRVUwkpSU', 'yWVAsIXIDCQb', 'SPAM-42'),
(43, 'PNcvsQdpwTIZG', 'vXFNdQOzjUiX', 'mAulkRGL', 'SPAM-43'),
(44, 'iAeyoQeHDCp', 'tcBSyCnZoEM', 'KHgskDgR', 'SPAM-44'),
(45, 'LGACjGvpnYmUmG', 'pTspuiguTWdycT', 'MMHfLLWwMsSRd', 'SPAM-45'),
(46, 'XbqeQxOkmFSO', 'bmibxAzJhD', 'MZhizgBCvKhg', 'SPAM-46'),
(47, 'xnPNrqRQmWvWXs', 'PShINVydxwTMjo', 'DTCEesUdlWIxZCy', 'SPAM-47'),
(48, 'qdyCCbGz', 'xPRtnzVR', 'XfGjVyUbTn', 'SPAM-48'),
(49, 'MAJOowqNWFa', 'PzzeYDareToqYAx', 'RKsvzaPlpfYL', 'SPAM-49'),
(50, 'XZFCFQGE', 'kreflglXLUqpK', 'vTJmtcWBBDOSv', 'SPAM-50'),
(51, 'IAILaYZptvC', 'HszzturfuMGiC', 'IQIekROupo', 'SPAM-51'),
(52, 'aNkvcODkqAeTbL', 'hdSyvwozQ', 'PuNutKMI', 'SPAM-52'),
(53, 'zrZaYyKJa', 'WFuoVjizxmiS', 'QRJaNEtYCiFwv', 'SPAM-53'),
(54, 'qLCQGtLqreaXlrH', 'bQNbYIThRvWQ', 'gbIOItYywk', 'SPAM-54'),
(55, 'xjrbMgKKlb', 'ztjHGhDESYk', 'WDIjxTzvh', 'SPAM-55'),
(56, 'ZoQuSDBHPnXUh', 'vUVKkoWvUZPGyY', 'OrXKBzrsG', 'SPAM-56'),
(57, 'ZfwFogzJSYo', 'uDPfvbHsPHbqJ', 'bHnSVfxEgwnDRN', 'SPAM-57'),
(58, 'jxbESBZXfeDGJ', 'PSCvEJJMzmvLh', 'uVvbVRAbHbNI', 'SPAM-58'),
(59, 'FmKdWJsTfcByhwU', 'IqTuURhvH', 'ErUDejLqrHFfA', 'SPAM-59'),
(60, 'DiTJyEhvm', 'vDRBvvyUdmcyn', 'wbVuXgaWn', 'SPAM-60'),
(61, 'FiSusQxLM', 'pphQPCfHeegJRzG', 'AazfxgsRKYOssH', 'SPAM-61'),
(62, 'XlagzVYWKitnq', 'IfcAdZsbaT', 'UhYgoakCIELI', 'SPAM-62'),
(63, 'GoxjvGeohrjoi', 'EywrThMIKliN', 'DRYcjKMe', 'SPAM-63'),
(64, 'YMAKKAbA', 'RooZfCvIKjUVKA', 'CaHNIFtI', 'SPAM-64'),
(65, 'ZaURQdbVCHjlapv', 'JkOixaglqGHA', 'KNXtIRLsAvpCmEe', 'SPAM-65'),
(66, 'JEDLjbrrbOjE', 'cswWiZUVFXqbv', 'wUKMdLGYxtu', 'SPAM-66'),
(67, 'XpOCeNyFktFcKYn', 'DyLQtuQFayYbEo', 'hHywEHeinu', 'SPAM-67'),
(68, 'YUVvcuQRDd', 'nCARFUbErXIE', 'DDiNqNuaqe', 'SPAM-68'),
(69, 'JZMVbzXWu', 'vlbRWAQix', 'TBCxCIWWaUQD', 'SPAM-69'),
(70, 'Free entry in 2 a wkly comp to win FA Cup final tkts 21st May 2005. Text FA to 87121 to receive entry question(std txt rate)T&C''s apply 08452810075over18''s', 'WINNER!! As a valued network customer you have been selected to receivea £900 prize reward! To claim call 09061701461. Claim code KL341. Valid 12 hours only.', 'Had your mobile 11 months or more? U R entitled to Update to the latest colour mobiles with camera for Free! Call The Mobile Update Co FREE on 08002986030', 'SPAM-70'),
(71, 'Thanks for your subscription to Ringtone UK your mobile will be charged £5/month Please confirm by replying YES or NO. If you reply NO you will  be charged', '07732584351 - Rodger Burns - MSG = We tried to call you re your reply to our sms for a free nokia mobile + free camcorder. Please call now 08000930705 for delivery tomorrow', 'SMS. ac Sptv: The New Jersey Devils and the Detroit Red Wings play Ice Hockey. Correct or Incorrect? End? Reply END SPTV', 'SPAM-71'),
(72, 'Your free ringtone is waiting to be collected. Simply text the password "MIX" to 85069 to verify. Get Usher and Britney. FML', 'GENT! We are trying to contact you. Last weekends draw shows that you won a £1000 prize GUARANTEED. Call 09064012160. Claim Code K52. Valid 12hrs only. 150ppm', 'You are a winner U have been specially selected 2 receive £1000 or a 4* holiday (flights inc) speak to a live operator 2 claim 0871277810910p/min (18+)', 'SPAM-72'),
(73, 'FreeMsg Why haven''t you replied to my text? I''m Randy', 'Customer service annoncement. You have a New Years delivery waiting for you. Please call 07046744435 now to arrange delivery', 'You are a winner U have been specially selected 2 receive £1000 cash or a 4* holiday (flights inc) speak to a live operator 2 claim 0871277810810', 'SPAM-73'),
(74, 'Will u meet ur dream partner soon? Is ur career off 2 a flyng start? 2 find out free', 'Congratulations ur awarded 500 of CD vouchers or 125gift guaranteed & Free entry 2 100 wkly draw txt MUSIC to 87066 TnCs www.Ldew.com1win150ppmx3age16', 'We tried to contact you re your reply to our offer of a Video Handset? 750 anytime networks mins? UNLIMITED TEXT? Camcorder? Reply or call 08000930705 NOW', 'SPAM-74'),
(75, 'UpgrdCentre Orange customer', 'okmail: Dear Dave this is your final ice to collect your 4* Tenerife Holiday or #5000 CASH award! Call 09061743806 from landline. TCs SAE Box326 CW25WX 150ppm', 'FREE MESSAGE Activate your 500 FREE Text Messages by replying to this message with the word FREE For terms & conditions', 'SPAM-75'),
(76, 'URGENT!: Your Mobile No. was awarded a £2', 'Today''s Offer! Claim ur £150 worth of discount vouchers! Text YES to 85023 now! SavaMob', 'You will recieve your tone within the next 24hrs. For Terms and conditions please see Channel U Teletext Pg 750', 'SPAM-76'),
(77, 'our mobile number has won £5000', 'We tried to contact you re your reply to our offer of 750 mins 150 textand a new video phone call 08002988890 now or reply for free delivery tomorrow', 'For ur chance to win a £250 wkly shopping spree TXT: SHOP to 80878. T''s&C''s www.txt-2-shop.com custcare 08715705022', 'SPAM-77'),
(78, 'You have an important customer service announcement from PREMIER. Call FREEPHONE 0800 542 0578 now!', '5 Free Top Polyphonic Tones call 087018728737', 'Orange customer', 'SPAM-78'),
(79, 'We tried to contact you re our offer of New Video Phone 750 anytime any network mins HALF PRICE Rental camcorder call 08000930705 or reply for delivery Wed', 'Last chance 2 claim ur £150 worth of discount vouchers-Text YES to 85023 now!SavaMob-member offers mobile T Cs 08717898035. £3.00 Sub. 16 . Remove txt X or STOP', 'Urgent! call 09066350750 from your landline. Your complimentary 4* Ibiza Holiday or 10', 'SPAM-79');

INSERT INTO staging.training_spam_mailing_address_stage
    (row_id, street1, city, post_code, usrname, country) VALUES
(0, 'ZPPhdSjsVq', 'UNjkQaOwttzoTa', 'xIyztswRsUOb', 'SPAM-0', 'Training data set'),
(1, 'fCFsTuAsiIn', 'TgHEpqljlRwJyf', 'DbCivzMU', 'SPAM-1', 'Training data set'),
(2, 'UpkCyeYsNCpmPzM', 'VVRoLCHEfmW', 'vjQltkvCuDDKLh', 'SPAM-2', 'Training data set'),
(3, 'vplCUdcGznA', 'nTtKhcXp', 'bCdyMPiT', 'SPAM-3', 'Training data set'),
(4, 'qDTVznyAbC', 'fKTQdGxyKjSP', 'shMWmdJbVJGFWh', 'SPAM-4', 'Training data set'),
(5, 'inVgARxhcVM', 'BCtoratpOXhgc', 'DPuPfVUE', 'SPAM-5', 'Training data set'),
(6, 'zExRDNHvPkBarWF', 'UwSfcgxIimGiy', 'BrRIEOAsYk', 'SPAM-6', 'Training data set'),
(7, 'TEUIrIhpo', 'QOVXeQfFyYxcVhC', 'JEZObbeGfhEQ', 'SPAM-7', 'Training data set'),
(8, 'VyCAjzHGjBOA', 'OpywfSCF', 'JoCjExka', 'SPAM-8', 'Training data set'),
(9, 'PyJMuMsHcgCdhk', 'rWhapFFrLDhYN', 'VBrJMfDHlnpzjJL', 'SPAM-9', 'Training data set'),
(10, 'KmVaVLajhgNq', 'KllOdQgdYCumThw', 'kiKXaNCoNFNJH', 'SPAM-10', 'Training data set'),
(11, 'ZIsMjEFIYaHI', 'kIDCxkWtequgUC', 'pkHQhxOZJeQe', 'SPAM-11', 'Training data set'),
(12, 'dhxHZCrJElhGMt', 'qHSxQJxBI', 'xJObhSEBkozGw', 'SPAM-12', 'Training data set'),
(13, 'KvIcmOMlQK', 'ZMnxreVbp', 'BfYzQKuxUJCygr', 'SPAM-13', 'Training data set'),
(14, 'GlJYUhkBDe', 'OksqLsljIyo', 'llpjzFAkrbHTmb', 'SPAM-14', 'Training data set'),
(15, 'YufMpWFaGcAK', 'ByWojPSwjIBzW', 'aAsWmDlsxPerS', 'SPAM-15', 'Training data set'),
(16, 'kTWSsnrva', 'YNXEPMIhzIpSFss', 'KazmaIht', 'SPAM-16', 'Training data set'),
(17, 'XXwjsJzifmSTbp', 'FJRtrptgHoilYU', 'dUAVfioRqzaLa', 'SPAM-17', 'Training data set'),
(18, 'JFEmIJJwdKBbLbn', 'XiWTbYhuRQ', 'YzGYdOGAGzCDeVn', 'SPAM-18', 'Training data set'),
(19, 'oeBsrJkwjIjo', 'GCFSECCKmHnCjS', 'anjyVakA', 'SPAM-19', 'Training data set'),
(20, 'QiYBzqrblZP', 'TUYRKMjyayAn', 'axWJNZxDr', 'SPAM-20', 'Training data set'),
(21, 'bknrGFVrKRPJntU', 'AxPtUqcdPN', 'hxwzdarKmNRUcM', 'SPAM-21', 'Training data set'),
(22, 'ciZYHpfTUlhz', 'gpRbszukT', 'gVNGPWCYaWmybIH', 'SPAM-22', 'Training data set'),
(23, 'ZPLFrsgZqAbWt', 'sBONNWSCdyrx', 'mSEKmENLnRTq', 'SPAM-23', 'Training data set'),
(24, 'NoaFuRHgdbnO', 'CWtfIPTXOL', 'pkNfBXcnLQQ', 'SPAM-24', 'Training data set'),
(25, 'JUYDAqbIKiIdovd', 'frPJYOKUXoyX', 'TsAqEYWSM', 'SPAM-25', 'Training data set'),
(26, 'kLLsIQNxRAjt', 'NyVsOQjth', 'RVTUcXuL', 'SPAM-26', 'Training data set'),
(27, 'UbMkvlTL', 'cgJgKUPuJoTS', 'OVJabdSqPl', 'SPAM-27', 'Training data set'),
(28, 'ZPPhdSjsVq', 'UNjkQaOwttzoTa', 'xIyztswRsUOb', 'SPAM-28', 'Training data set'),
(29, 'fCFsTuAsiIn', 'TgHEpqljlRwJyf', 'DbCivzMU', 'SPAM-29', 'Training data set'),
(30, 'UbMkvlTL', 'cgJgKUPuJoTS', 'OVJabdSqPl', 'SPAM-30', 'Training data set'),
(31, 'YypYJPDFnjeHiYl', 'iQqXMjkA', 'hkHWjRoRQsWaRKW', 'SPAM-31', 'Training data set'),
(32, 'Charlotte Amalie', 'Charlotte Amalie', '155143', 'SPAM-32', 'Training data set'),
(33, 'Banepa', 'Banepa', '115223', 'SPAM-33', 'Training data set'),
(34, 'Kulim', 'Kulim', '111431', 'SPAM-34', 'Training data set'),
(35, 'Kulim', 'Kulim', '132351', 'SPAM-35', 'Training data set'),
(36, 'Ta''raout', 'Ta''raout', '152135', 'SPAM-36', 'Training data set'),
(37, 'Algiers', 'Algiers', '132131', 'SPAM-37', 'Training data set'),
(38, 'Kabul', 'Kabul', '131534', 'SPAM-38', 'Training data set'),
(39, 'Kabul', 'Kabul', '135424', 'SPAM-39', 'Training data set'),
(40, 'Santa Maria', 'Santa Maria', '125154', 'SPAM-40', 'Training data set'),
(41, 'Santa Maria', 'Santa Maria', '115315', 'SPAM-41', 'Training data set'),
(42, 'mLMUmaRm', 'cnfZaqrDTvJTgv', 'FNsMxsBBrbQP', 'SPAM-42', 'Training data set'),
(43, 'KeggEayqYBOW', 'ttcxlrEFfoCTd', 'xbdEcXuEnSP', 'SPAM-43', 'Training data set'),
(44, 'mfVAwatByil', 'BJhPFObprUu', 'YZyKLxQgmg', 'SPAM-44', 'Training data set'),
(45, 'kLnegxyMITFSnoj', 'JHCWNpGJzJ', 'cgdyStXAh', 'SPAM-45', 'Training data set'),
(46, 'OHWVoKDJs', 'YcQmmipFff', 'DVTZvvXDE', 'SPAM-46', 'Training data set'),
(47, 'REOhLZjDRHXijLa', 'MMOaoUFEPGg', 'bBiWlwYLCZo', 'SPAM-47', 'Training data set'),
(48, 'nddIKfHUb', 'plKgsVrPFiHQe', 'ZiLZtcicPd', 'SPAM-48', 'Training data set'),
(49, 'llskUthLMF', 'YTAQNiEXTdNNy', 'HoVgnFYyNLF', 'SPAM-49', 'Training data set'),
(50, 'FjOhAzhKJU', 'nTUwwVBc', 'rakKolpgSWmC', 'SPAM-50', 'Training data set'),
(51, 'ndiHvDVxge', 'VMsKaAEMrbnmEl', 'WiVQAHeMckhPRUo', 'SPAM-51', 'Training data set'),
(52, 'NiEmCQFMnkFb', 'nUsrdfkBA', 'uJYhltOqOgT', 'SPAM-52', 'Training data set'),
(53, 'zzWVwIOYi', 'oRCWNUiDezYRRs', 'GHaFMvugmtkcKwc', 'SPAM-53', 'Training data set'),
(54, 'BAxCiZfgtrR', 'qYwuhAQuK', 'OVwYiUKcdffol', 'SPAM-54', 'Training data set'),
(55, 'uEhWUfZy', 'mgwpcMlsJri', 'xdeQnzCExmUg', 'SPAM-55', 'Training data set'),
(56, 'ktUTzBNddq', 'qOjSbgdHzfkY', 'biopsJCnV', 'SPAM-56', 'Training data set'),
(57, 'IjbUgokswB', 'iSZiTIKnO', 'PwqesrnCG', 'SPAM-57', 'Training data set'),
(58, 'wpPsCUvXgqNsNqs', 'JYVuWiHKsUycRF', 'GvSHIupfmsTs', 'SPAM-58', 'Training data set'),
(59, 'zDnDEgHAjvVFe', 'UBiRfxQmQS0', 'INToRhCCXPKx', 'SPAM-59', 'Training data set'),
(60, 'IqUpSnSUopS', 'kmGwUhaAGpt', 'fQYKjyli', 'SPAM-60', 'Training data set'),
(61, 'YjORtfnKS', 'jIHYNymDJUtD', 'XD1o1MorHt', 'SPAM-61', 'Training data set'),
(62, 'tC1g0SeADDcadu', 'sYzkapkFhla', 'RezYSkFyMadiO', 'SPAM-62', 'Training data set'),
(63, 'jxfEkVpuv', 'xyoSKUdlapNZT', 'PmaznNwkk', 'SPAM-63', 'Training data set'),
(64, 'bBnXEihLqSbEJXU', 'BsgiMkdulhKcD', 'mCmlHGvmL', 'SPAM-64', 'Training data set'),
(65, 'SqCUdFlqz', 'Jx1KWrippB', 'CNvfAZGWQ', 'SPAM-65', 'Training data set'),
(66, 'zmlahPtaSs', 'DvmDIwhNWHiRuo', 'IHWsUEAIaRHtVa', 'SPAM-66', 'Training data set'),
(67, 'VMyGHrtQfvHSJO', 'ImHIqgZxQT', 'MMtOvhdJlaVgLW', 'SPAM-67', 'Training data set'),
(68, 'hbZPIDNuhHw', 'IBOokpPnqg0XkGe', 'anByEynyJHPMIrG', 'SPAM-68', 'Training data set'),
(69, 'DyRHSqhrHb', 'UhQTKbcQpkaJDm', 'gWpHZoVPdPSkVr', 'SPAM-69', 'Training data set'),
(70, 'SIX chances to win CASH! From 100 to 20,000 pounds txt> CSH11 and send to 87575. Cost 150p/day, 6days, 16+ TsandCs apply Reply HL 4 info', '', 'URGENT! You have won a 1 week FREE membership in our £100,000 Prize Jackpot! Txt the word: CLAIM to No: 81010 T&C www.dbuk.net LCCLTD POBOX 4403LDNW1A7RW18', 'SPAM-70', 'Training data set'),
(71, 'Congrats! 1 year special cinema pass for 2 is yours. call 09061209465 now! C Suprman V', 'As a valued customer', 'Urgent UR awarded a complimentary trip to EuroDisinc Trav', 'SPAM-71', 'Training data set'),
(72, 'PRIVATE! Your 2004 Account Statement for 07742676969 shows 786 unredeemed Bonus Points. To claim call 08719180248 Identifier Code: 45239 Expires', 'URGENT! Your Mobile No. was awarded £2000 Bonus Caller Prize on 5/9/03 This is our final try to contact U! Call from Landline 09064019788 BOX42WR29C', 'Todays Voda numbers ending 7548 are selected to receive a $350 award. If you have a match please call 08712300220 quoting claim code 4041 standard rates app', 'SPAM-72', 'Training data set'),
(73, 'URGENT! We are trying to contact you. Last weekends draw shows that you have won a £900 prize GUARANTEED. Call 09061701939. Claim code S89. Valid 12hrs only', 'Please call our customer service representative on FREEPHONE 0808 145 4742 between 9am-11pm as you have WON a guaranteed £1000 cash or £5000 prize!', 'Are you unique enough? Find out from 30th August. www.areyouunique.co.uk', 'SPAM-73', 'Training data set'),
(74, 'Ur ringtone service has changed! 25 Free credits! Go to club4mobiles.com to choose content now! Stop? txt CLUB STOP to 87070. 150p/wk Club4 PO Box1146 MK45 2WT', 'Ringtone Club: Get the UK singles chart on your mobile each week and choose any top quality ringtone! This message is free of charge.', 'HMV BONUS SPECIAL 500 pounds of genuine HMV vouchers to be won. Just answer 4 easy questions. Play Now! Send HMV to 86688 More info:www.100percent-real.com', 'SPAM-74', 'Training data set'),
(75, 'Congrats! 1 year special cinema pass for 2 is yours. call 09061209465 now! C Suprman V', 'You are guaranteed the latest Nokia Phone', 'Boltblue tones for 150p Reply POLY# or MONO# eg POLY3 1. Cha Cha Slide 2. Yeah 3. Slow Jamz 6. Toxic 8. Come With Me or STOP 4 more tones txt MORE', 'SPAM-75', 'Training data set'),
(76, 'PRIVATE! Your 2003 Account Statement for 07815296484 shows 800 un-redeemed S.I.M. points. Call 08718738001 Identifier Code 41782 Expires 18/11/04', 'from www.Applausestore.com MonthlySubscription@50p/msg max6/month T&CsC web age16 2stop txt stop', 'GENT! We are trying to contact you. Last weekends draw shows that you won a £1000 prize GUARANTEED. Call 09064012160. Claim Code K52. Valid 12hrs only. 150ppm', 'SPAM-76', 'Training data set'),
(77, 'You have been specially selected to receive a 2000 pound award! Call 08712402050 BEFORE the lines close. Cost 10ppm. 16+. T&Cs apply. AG Promo', 'PRIVATE! Your 2003 Account Statement for 07753741225 shows 800 un-redeemed S. I. M. points. Call 08715203677 Identifier Code: 42478 Expires 24/10/04', 'You have an important customer service announcement. Call FREEPHONE 0800 542 0825 now!', 'SPAM-77', 'Training data set'),
(78, 'SMSSERVICES. for yourinclusive text credits', '25p 4 alfie Moon''s Children in need song on ur mob. Tell ur m8s. Txt Tone charity to 8007 for Nokias or Poly charity for polys: zed 08701417012 profit 2 charity.', 'Dear Voucher Holder', 'SPAM-78', 'Training data set'),
(79, 'Today''s Offer! Claim ur £150 worth of discount vouchers! Text YES to 85023 now! SavaMob', 'Congratulations ur awarded either a yrs supply of CDs from Virgin Records or a Mystery Gift GUARANTEED Call 09061104283 Ts&Cs www.smsco.net £1.50pm approx 3mins', 'PRIVATE! Your 2003 Account Statement for 07808 XXXXXX shows 800 un-redeemed S. I. M. points. Call 08719899217 Identifier Code: 41685 Expires 07/11/04', 'SPAM-79', 'Training data set');

-- Non-spam training data
--    * Names are from https://github.com/sigpwned/popular-names-by-country-dataset (first names are a random sample of 100 Localized forenames, middle names are a random sample of 100 romanized forenames, last names are a random sample of 100 last names)
--    * Addresses are a random sample of 34 canadian, 33 czech, and 33 thai addresses https://openstreetdata.org/

INSERT INTO staging.training_user_stage(row_id, first_given_name, second_given_name, family_name, usrname) VALUES
(0, 'José', 'Nuray', 'Κουφός', 'NOTSPAM-0'),
(1, 'Maysoun', 'Armen', 'חן', 'NOTSPAM-1'),
(2, 'Emily', 'David', '清水', 'NOTSPAM-2'),
(3, 'ليان', 'Mohammad', 'Alonso', 'NOTSPAM-3'),
(4, 'Niko', 'Mila', 'Messina', 'NOTSPAM-4'),
(5, '凪', 'Trinidad', 'Krier', 'NOTSPAM-5'),
(6, 'Noah', 'Raphaël', 'ខៀវ', 'NOTSPAM-6'),
(7, 'Amelia', 'Emil', 'Gonçalves', 'NOTSPAM-7'),
(8, 'Danna', 'Melisa', 'Hernández', 'NOTSPAM-8'),
(9, 'Andreea', 'Mia', '梁', 'NOTSPAM-9'),
(10, 'Amir', 'Mateo', 'Ortiz', 'NOTSPAM-10'),
(11, 'Esther', 'Tereza', 'Munteanu', 'NOTSPAM-11'),
(12, 'Amar', 'Айзере', 'Hämäläinen', 'NOTSPAM-12'),
(13, 'Santiago', 'Laura', '徐', 'NOTSPAM-13'),
(14, 'Vamika', 'Драгана', 'Godoy', 'NOTSPAM-14'),
(15, '奕泽', 'Louis', 'Barbosa', 'NOTSPAM-15'),
(16, 'Gael', 'Theodore', 'Pacheco', 'NOTSPAM-16'),
(17, 'Koa', 'Juan', 'Neri', 'NOTSPAM-17'),
(18, 'Martha', 'Sofía', 'Giménez', 'NOTSPAM-18'),
(19, 'Alice', 'Mia', 'ពិជ', 'NOTSPAM-19'),
(20, 'Noah', 'Wassim', 'Polák', 'NOTSPAM-20'),
(21, 'Grace', 'Googoosh', 'Vujović', 'NOTSPAM-21'),
(22, 'Salik', 'Jákup', 'Ponce', 'NOTSPAM-22'),
(23, 'Emilia', 'Gabriel', 'Ribeiro', 'NOTSPAM-23'),
(24, 'Tommaso', 'Assia', 'Ceban', 'NOTSPAM-24'),
(25, 'Doha', '依诺', '横山', 'NOTSPAM-25'),
(26, 'Archie', 'Maja', 'ឈិត', 'NOTSPAM-26'),
(27, 'Hossein', 'Emma', 'Алиев', 'NOTSPAM-27'),
(28, 'Fatemeh-Zahra', 'Emma', 'Khan', 'NOTSPAM-28'),
(29, 'Dhruv', 'Ema', 'Micallef', 'NOTSPAM-29'),
(30, 'Henry', 'Tehei', 'Ozoliņš', 'NOTSPAM-30'),
(31, 'Amelia', 'Gabriel', 'Figueiredo', 'NOTSPAM-31'),
(32, 'Marija', '수아', 'Kavaliauskas', 'NOTSPAM-32'),
(33, 'Liam', 'Valter', 'Jovanović', 'NOTSPAM-33'),
(34, 'Shivansh', 'Omphile', 'Wagner', 'NOTSPAM-34'),
(35, 'Emilia', 'Raul', 'Mac Cárthaigh', 'NOTSPAM-35'),
(36, 'Χρήστος', 'Alice', '杉山', 'NOTSPAM-36'),
(37, 'Dominykas', 'Theodore', 'Carvalho', 'NOTSPAM-37'),
(38, 'Mia', 'Robert', 'MacDonald', 'NOTSPAM-38'),
(39, 'Thomas', 'Sara', 'Ó Dochartaigh', 'NOTSPAM-39'),
(40, 'Theo', 'Mohammad', 'Vidal', 'NOTSPAM-40'),
(41, 'Noah', 'Mila', 'Fekete', 'NOTSPAM-41'),
(42, 'Theo', 'Fatemeh', 'Gutierrez', 'NOTSPAM-42'),
(43, 'Theo', 'Viktoriya', 'Gómez', 'NOTSPAM-43'),
(44, 'Sumayah', 'Natalija', 'Jayasekara', 'NOTSPAM-44'),
(45, 'Adam', 'Иван', 'Ղազարյան', 'NOTSPAM-45'),
(46, 'Isabel', 'Luis', '桜井', 'NOTSPAM-46'),
(47, 'Драгана', 'Mohammad', 'Ramadan', 'NOTSPAM-47'),
(48, 'Oliver', 'Ivy', '小川', 'NOTSPAM-48'),
(49, 'Juan', 'Alma', 'ខាយ', 'NOTSPAM-49'),
(50, 'Georgia', 'Hàoyǔ', 'García', 'NOTSPAM-50'),
(51, 'Jude', 'Liz', 'Hong', 'NOTSPAM-51'),
(52, 'Thomas', 'Junior', 'Leclercq', 'NOTSPAM-52'),
(53, 'Emma', 'Noah', 'Ohana', 'NOTSPAM-53'),
(54, 'Moana', 'Angelo', 'Cojocari', 'NOTSPAM-54'),
(55, 'Hannah', 'Toivo', 'López', 'NOTSPAM-55'),
(56, 'Alise', 'Sophie', 'Álvarez', 'NOTSPAM-56'),
(57, 'Isabelle', 'Manua', 'Alarcón', 'NOTSPAM-57'),
(58, 'Shaimaa', 'Miguel Ángel', 'Andersen', 'NOTSPAM-58'),
(59, 'Daniel', 'Gunel', 'Pop', 'NOTSPAM-59'),
(60, 'Evgeny', 'Olivia', 'Thy', 'NOTSPAM-60'),
(61, 'Oliver', 'Indira', 'Hasani', 'NOTSPAM-61'),
(62, 'Edoardo', 'Thiago', 'O''Moore', 'NOTSPAM-62'),
(63, 'Salik', 'Saqib', 'Núñez', 'NOTSPAM-63'),
(64, 'Nare', 'Lukas', 'Flores', 'NOTSPAM-64'),
(65, 'Dimitra', 'Gabija', 'Gang', 'NOTSPAM-65'),
(66, 'Ju-won', 'Emma', 'Markoski', 'NOTSPAM-66'),
(67, 'Margarida', 'Vera', 'Ponce', 'NOTSPAM-67'),
(68, 'Daniel', 'Juan', 'Miranda', 'NOTSPAM-68'),
(69, 'Olivia', 'Ian', 'Munteanu', 'NOTSPAM-69'),
(70, 'Celeste', 'Andrias', 'Ōtsuka', 'NOTSPAM-70'),
(71, 'Frida', 'Sofia', 'Peiris', 'NOTSPAM-71'),
(72, 'Chun-hung', 'Fatima', 'Yıldız', 'NOTSPAM-72'),
(73, 'Omar', 'Maya', 'Jung', 'NOTSPAM-73'),
(74, 'Leon', 'Elmar', 'Afërdita', 'NOTSPAM-74'),
(75, 'Mariam', 'Manuela', 'Harada', 'NOTSPAM-75'),
(76, 'Jouri', 'David', 'Sow', 'NOTSPAM-76'),
(77, 'Oliver', 'Safiya', 'Lehner', 'NOTSPAM-77'),
(78, 'Olivia', 'Marija', 'Ramírez', 'NOTSPAM-78'),
(79, 'Aoi', 'Isabella', 'Bošnjak', 'NOTSPAM-79'),
(80, 'Fiadh', 'Jokūbas', 'Wojciechowski', 'NOTSPAM-80'),
(81, 'Mohamed', 'Samuel', 'U', 'NOTSPAM-81'),
(82, 'Felix', 'Edward', 'Young', 'NOTSPAM-82'),
(83, 'Hamza', 'Suha', 'Aydın', 'NOTSPAM-83'),
(84, 'Yasna', 'Noah', 'Ra', 'NOTSPAM-84'),
(85, 'Camila', 'Isaac', 'Mejía', 'NOTSPAM-85'),
(86, 'Abdallah', 'Santiago', 'Rivera', 'NOTSPAM-86'),
(87, 'Emine', 'Mia', 'Diaz', 'NOTSPAM-87'),
(88, 'Juana', 'Luca', 'Naidu', 'NOTSPAM-88'),
(89, 'Adam', 'Chloe', 'Ho', 'NOTSPAM-89'),
(90, 'Ema', 'Noah', 'Moreau', 'NOTSPAM-90'),
(91, 'Santiago', 'Yusef', 'Moser', 'NOTSPAM-91'),
(92, 'Sultan', 'Chuluun', 'Martín', 'NOTSPAM-92'),
(93, 'Roghayyeh', 'Noah', 'Phí', 'NOTSPAM-93'),
(94, 'Fatoumata', 'Lia', 'Rai', 'NOTSPAM-94'),
(95, 'Marta', 'Gabriel', 'Pérez', 'NOTSPAM-95'),
(96, 'Aariz', 'Fatima', 'Rivera', 'NOTSPAM-96'),
(97, 'Daniel', 'Fahad', 'Wilson', 'NOTSPAM-97'),
(98, 'Ayla', 'Noah', 'Mitchell', 'NOTSPAM-98'),
(99, 'Alma', 'Daniel Alejandro', 'de Silva', 'NOTSPAM-99');


INSERT INTO staging.training_mailing_address_stage
    (row_id, street1, city, post_code, usrname, country) VALUES
(0, 'U jízdárny 1665', 'Brandýs nad Labem-Stará Boleslav', '250 01', 'NOTSPAM-0', 'Training data set'),
(1, 'Meruňková 583', 'Litoměřice', '412 01', 'NOTSPAM-1', 'Training data set'),
(2, 'Lipická 2561', 'Pelhřimov', '393 01', 'NOTSPAM-2', 'Training data set'),
(3, 'U Statku 635', 'Hýskov', '267 06', 'NOTSPAM-3', 'Training data set'),
(4, 'Příčná 124', 'Úhonice', '252 18', 'NOTSPAM-4', 'Training data set'),
(5, 'Lesní 710', 'Vacenovice', '696 06', 'NOTSPAM-5', 'Training data set'),
(6, 'Luční 4328', 'Chomutov', '430 01', 'NOTSPAM-6', 'Training data set'),
(7, 'Raisova 135', 'Frýdek-Místek', '738 01', 'NOTSPAM-7', 'Training data set'),
(8, 'Zimní 2429', 'Uherský Brod', '688 01', 'NOTSPAM-8', 'Training data set'),
(9, 'Jitkovská 1', 'Praha', '104 00', 'NOTSPAM-9', 'Training data set'),
(10, 'Za Tržnicí 222', 'Mikulovice', '790 84', 'NOTSPAM-10', 'Training data set'),
(11, 'Kosmova 4173', 'Chomutov', '430 03', 'NOTSPAM-11', 'Training data set'),
(12, 'Bukovická 51', 'Velké Losiny', '788 15', 'NOTSPAM-12', 'Training data set'),
(13, 'Řeznická 1490', 'Blatná', '388 01', 'NOTSPAM-13', 'Training data set'),
(14, 'K Hájku 67', 'Praha', '104 00', 'NOTSPAM-14', 'Training data set'),
(15, 'Široká 94', 'Lhota', '277 14', 'NOTSPAM-15', 'Training data set'),
(16, 'Na Pomezí 276', 'Štěchovice', '252 07', 'NOTSPAM-16', 'Training data set'),
(17, 'U Dráhy 159', 'Vrbová Lhota', '289 11', 'NOTSPAM-17', 'Training data set'),
(18, 'Třebíčská 1', 'Kralice nad Oslavou', '675 73', 'NOTSPAM-18', 'Training data set'),
(19, 'Komenského 46', 'Dobrovice', '294 41', 'NOTSPAM-19', 'Training data set'),
(20, 'Ke Zvonečku 368', 'Doksy', '273 64', 'NOTSPAM-20', 'Training data set'),
(21, 'Krátká 60', 'Šenov', '739 34', 'NOTSPAM-21', 'Training data set'),
(22, 'Sportovní 191', 'Přítluky', '691 04', 'NOTSPAM-22', 'Training data set'),
(23, 'Na zákopech 172', 'Třinec', '739 61', 'NOTSPAM-23', 'Training data set'),
(24, 'Poštovská 174', 'Kyšice', '330 01', 'NOTSPAM-24', 'Training data set'),
(25, 'Na Vrchu 266', 'Praha', '155 00', 'NOTSPAM-25', 'Training data set'),
(26, 'Pod Stříbrníkem 35', 'Husinec', '250 68', 'NOTSPAM-26', 'Training data set'),
(27, 'Sadová 225', 'Kostelec nad Orlicí', '5174 1', 'NOTSPAM-27', 'Training data set'),
(28, 'Prostřední 1556', 'Brandýs nad Labem-Stará Boleslav', '250 01', 'NOTSPAM-28', 'Training data set'),
(29, 'lesní cesta Novodvorská 99', 'Benátky nad Jizerou', '294 71', 'NOTSPAM-29', 'Training data set'),
(30, 'Hliník 260', 'Šardice', '696 13', 'NOTSPAM-30', 'Training data set'),
(31, 'Netolická 25', 'Markvartice', '507 43', 'NOTSPAM-31', 'Training data set'),
(32, 'Severní 388', 'Brodce', '294 73', 'NOTSPAM-32', 'Training data set'),
(33, '679 ถนนเพชรเกษม', 'กุยบุรี', '77150', 'NOTSPAM-33', 'Training data set'),
(34, '165 Moo 2 Soi Wangwon 4 Songpinong', 'Ban Tha Ling Lom', '76170', 'NOTSPAM-34', 'Training data set'),
(35, '21 Ramkhamhaeng 21', 'Bangkok', '10310', 'NOTSPAM-35', 'Training data set'),
(36, '2 Soi Soonvijai 7, New Petchaburi Road 47', 'Bangkok', '10310', 'NOTSPAM-36', 'Training data set'),
(37, '138 ถนนเพชรเกษม', 'เมืองตรัง', '92000', 'NOTSPAM-37', 'Training data set'),
(38, '152 Moo 13 Ban Huai Nam Khao', 'Phayao', '56000', 'NOTSPAM-38', 'Training data set'),
(39, '259 Sukhumvit Rd', 'ปากเกร็ด', '11120', 'NOTSPAM-39', 'Training data set'),
(40, '719 ถนนบรรทัดทอง', 'แขวงวังใหม่ เขตปทุมวัน กรุงเทพมหานคร', '10330', 'NOTSPAM-40', 'Training data set'),
(41, '397 Krung Thonburi Soi 4', 'Bangkok', '10600', 'NOTSPAM-41', 'Training data set'),
(42, '47 Chotana Road', 'Chiang Mai', '50300', 'NOTSPAM-42', 'Training data set'),
(43, '119 Wiang Tai, Pai', 'Mae Hong Son', '58130', 'NOTSPAM-43', 'Training data set'),
(44, '87 ถนนวิทยุ', 'แขวงลุมพินี', '10330', 'NOTSPAM-44', 'Training data set'),
(45, '60 ถนนสายเอเชีย', 'หมู่ที่ 3', '13000', 'NOTSPAM-45', 'Training data set'),
(46, '214 Chakrapong Road', 'Bangkok', '10200', 'NOTSPAM-46', 'Training data set'),
(47, '70 Soi Rom Yen', 'Bangkok', '10310', 'NOTSPAM-47', 'Training data set'),
(48, '66 หมู่ที่ 10', 'ตำบลบางเลน', '11140', 'NOTSPAM-48', 'Training data set'),
(49, '2 ถนนราชพฤกษ์', 'Chiang Mai', '50300', 'NOTSPAM-49', 'Training data set'),
(50, '45 เพชรเกษม 77 แยก 2-5', 'หนองแขม', '10160', 'NOTSPAM-50', 'Training data set'),
(51, '94 Soi Suphaphong 1', 'Bangkok', '10250', 'NOTSPAM-51', 'Training data set'),
(52, '88 Udomsuk Alley', 'Bangkok', '10310', 'NOTSPAM-52', 'Training data set'),
(53, '25 Wachiratham Sathit 23 Sukhumvit101/1', 'Bangkok', '10260', 'NOTSPAM-53', 'Training data set'),
(54, '15 ถนนกาญจนวณิชย์', 'Hat Yai', '90110', 'NOTSPAM-54', 'Training data set'),
(55, '1 Soi Chalongkrung 1', 'Ladkrabang', '10520', 'NOTSPAM-55', 'Training data set'),
(56, '1 ถนนรองเมือง', 'แขวงรองเมือง', '10330', 'NOTSPAM-56', 'Training data set'),
(57, '6 นครสวรรค์', 'ตลาด', '44000', 'NOTSPAM-57', 'Training data set'),
(58, '98 เอกชัย 36', 'bangkok', '10160', 'NOTSPAM-58', 'Training data set'),
(59, '146 Srinakarin Road', 'Bangkok', '10250', 'NOTSPAM-59', 'Training data set'),
(60, '1 South Sathorn Road', 'Bangkok', '10120', 'NOTSPAM-60', 'Training data set'),
(61, '40 ถนนบุญวาทย์', 'หัวเวียง เมืองลำปาง', '52000', 'NOTSPAM-61', 'Training data set'),
(62, '96 Soi Chakraporn', 'Bangkok', '10200', 'NOTSPAM-62', 'Training data set'),
(63, '300 Moo 3', 'Tambon Thongchai', '77190', 'NOTSPAM-63', 'Training data set'),
(64, '193 Prachasongkro Rd. (Soi 27)', 'Bangkok', '10400', 'NOTSPAM-64', 'Training data set'),
(65, '29 ถนนธนุษย์พงษ์', 'เชียงใหม่', '50000', 'NOTSPAM-65', 'Training data set'),
(66, '5704 Pinepoint Drive NE', 'Calgary', 'T1Y 2B4', 'NOTSPAM-66', 'Training data set'),
(67, '7450 Boulevard Sainte-Anne', 'Château-Richer', 'G0A 1N0', 'NOTSPAM-67', 'Training data set'),
(68, '5949 Avenue McLynn', 'Montréal', 'H3X 2R3', 'NOTSPAM-68', 'Training data set'),
(69, '2 St. Theresa''s Court', 'St. John''s', 'A1E 4Y9', 'NOTSPAM-69', 'Training data set'),
(70, '45575 Keith Wilson Road', 'Chilliwack', 'V2R 0M6', 'NOTSPAM-70', 'Training data set'),
(71, '4243 North Service Road', 'Burlington', 'L7L 4X6', 'NOTSPAM-71', 'Training data set'),
(72, '795 Clinton Road', 'Roseway', 'B0T 1W0', 'NOTSPAM-72', 'Training data set'),
(73, '8572 171 Street', 'Surrey', 'V4N 5J1', 'NOTSPAM-73', 'Training data set'),
(74, '1155 Rue Metcalfe', 'Montréal', 'H3B 2V6', 'NOTSPAM-74', 'Training data set'),
(75, '950 Huntleigh Crescent', 'Kamloops', 'V1S 1H1', 'NOTSPAM-75', 'Training data set'),
(76, '268 Croissant Netherwood', 'Hampstead', 'H3X 3Y8', 'NOTSPAM-76', 'Training data set'),
(77, '587 109e Rue', 'Shawinigan', 'G9P 2M6', 'NOTSPAM-77', 'Training data set'),
(78, '25 Carlton Street', 'Old Toronto', 'M5B 1L4', 'NOTSPAM-78', 'Training data set'),
(79, '5528 50 Avenue', 'Lloydminster', 'T9V 0X3', 'NOTSPAM-79', 'Training data set'),
(80, '300 Avenue H South', 'Saskatoon', 'S7M 1W3', 'NOTSPAM-80', 'Training data set'),
(81, '10410 Kennedy Road', 'Brampton', 'L6Z 0A7', 'NOTSPAM-81', 'Training data set'),
(82, '2 Elgin Street', 'Halifax', 'B3R 2C2', 'NOTSPAM-82', 'Training data set'),
(83, '1033 Rue des Rocailles', 'Québec', 'G2K 0L4', 'NOTSPAM-83', 'Training data set'),
(84, '580 Avenue du Marché', 'Shawinigan', 'G9N 0C8', 'NOTSPAM-84', 'Training data set'),
(85, '2 Edgevalley Gardens NW', 'Calgary', 'T3A 5H1', 'NOTSPAM-85', 'Training data set'),
(86, '70 Westchester Ave', 'St. Catharines', 'L2R 3P4', 'NOTSPAM-86', 'Training data set'),
(87, '63 Rue Bancroft', 'Gatineau', 'J9H 4N8', 'NOTSPAM-87', 'Training data set'),
(88, '1 Rue de l''Argile', 'Gatineau', 'J8Z 3E9', 'NOTSPAM-88', 'Training data set'),
(89, '2750 Joanna Terrace', 'Nanaimo', 'V9T3X1', 'NOTSPAM-89', 'Training data set'),
(90, '88 Rue Sabourin', 'Gatineau', 'J8P 4L3', 'NOTSPAM-90', 'Training data set'),
(91, '1090 Lockley Road', 'Esquimalt', 'V9A 4S3', 'NOTSPAM-91', 'Training data set'),
(92, '767 Silver Seven Road', 'Kanata', 'K2V 0H1', 'NOTSPAM-92', 'Training data set'),
(93, '1 Harvey Drive', 'Newport Station', 'B0N 2B0', 'NOTSPAM-93', 'Training data set'),
(94, '988 Tillison Avenue', 'Cobourg', 'K9A 5N3', 'NOTSPAM-94', 'Training data set'),
(95, '10 North Street', 'Loyalist', 'K0H 2H0', 'NOTSPAM-95', 'Training data set'),
(96, '330 Assiniboine Park Drive', 'Winnipeg', 'R3J', 'NOTSPAM-96', 'Training data set'),
(97, '353 Boulevard Saint-René Ouest', 'Gatineau', 'J8P 2W3', 'NOTSPAM-97', 'Training data set'),
(98, '966 Rue Saint-Jean', 'Québec', 'G1R 1R5', 'NOTSPAM-98', 'Training data set'),
(99, '1 Auburn Court', 'Westphal', 'B2W 3N5', 'NOTSPAM-99', 'Training data set');

------------------------------------------
-- End training data
------------------------------------------

INSERT INTO permission.perm_list ( id, code, description ) VALUES
 ( 694, 'BLOCK_EMAIL', oils_i18n_gettext( 694,
    'Allow a staff member to block an email address as spam', 'ppl', 'description' )),
 ( 695, 'MARK_SPAM', oils_i18n_gettext( 695,
    'Allow a staff member to mark a patron self-registration as spam', 'ppl', 'description' )),
 ( 696, 'ADMIN_SPAM', oils_i18n_gettext( 696,
    'Allow a staff member to administer spam protections', 'ppl', 'description' ))
    ON CONFLICT DO NOTHING;

INSERT INTO permission.grp_perm_map (grp, perm, depth, grantable)
    SELECT
	    pgt.id, perm.id, aout.depth, TRUE
    FROM
        permission.grp_tree pgt,
        permission.perm_list perm,
        actor.org_unit_type aout
    WHERE
        pgt.name = 'Circulation Administrator' AND
        aout.name = 'Consortium' AND
        perm.code IN ('ADMIN_SPAM', 'BLOCK_EMAIL');

INSERT INTO permission.grp_perm_map (grp, perm, depth, grantable)
    SELECT
	    pgt.id, perm.id, aout.depth, TRUE
    FROM
        permission.grp_tree pgt,
        permission.perm_list perm,
        actor.org_unit_type aout
    WHERE
        pgt.name = 'Circulators' AND
        aout.name = 'Consortium' AND
        perm.code IN ('MARK_SPAM');

INSERT INTO config.workstation_setting_type (name, grp, datatype, label)
VALUES (
    'eg.grid.admin.permission.email_block_list', 'gui', 'object',
    oils_i18n_gettext(
        'eg.grid.admin.permission.email_block_list',
        'Grid Config: admin.permission.email_block_list',
        'cwst', 'label'
    )), (
    'eg.grid.admin.spam.measurement', 'gui', 'object',
    oils_i18n_gettext(
        'eg.grid.admin.spam.measurement',
        'Grid Config: admin.spam.measurement',
        'cwst', 'label'
    )
) ON CONFLICT DO NOTHING;

INSERT INTO config.global_flag (name, label)
    VALUES (
        'opac.spam_filter.use_local_data',
        oils_i18n_gettext(
            'opac.spam_filter.use_local_data',
            'OPAC: Use data from your Evergreen installation to train the spam filter.  When not enabled, the spam filter will use the basic stock training data instead.',
            'cgf', 
            'label'
        )
) ON CONFLICT DO NOTHING;

COMMIT;
