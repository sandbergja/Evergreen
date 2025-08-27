BEGIN;

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

COMMIT;
