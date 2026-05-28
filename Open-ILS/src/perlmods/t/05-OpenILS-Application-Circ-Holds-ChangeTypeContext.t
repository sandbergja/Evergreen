#!perl
use strict;
use warnings;

use Test::More tests => 3;
use Test::MockObject;

use OpenILS::Const qw/:const/;

use_ok( 'OpenILS::Application::Circ::Holds::ChangeTypeContext' );

subtest 'with_target_as_params', sub {
    plan tests => 1;

    my $original_hold = Test::MockObject->new;
    $original_hold->set_always('usr', 456);
    $original_hold->set_always('selection_depth', 0);
    $original_hold->set_always('pickup_lib', 4);
    $original_hold->set_always('selection_ou', 4);
    my $desired_type = OILS_HOLD_TYPE_COPY;
    my $requestor_id = 1;
    my $ctx = OpenILS::Application::Circ::Holds::ChangeTypeContext->new(
        $original_hold,
        $desired_type,
        $requestor_id
    );

    is_deeply $ctx->with_target_as_params(123), {
        copy_id => 123,
        depth => 0,
        hold_type => OILS_HOLD_TYPE_COPY,
        patronid => 456,
        pickup_lib => 4,
        selection_ou => 4,
    }, 'it can convert to params compatible with open-ils.circ.title_hold.is_possible';
};

subtest 'possible_targets', sub {
    plan tests => 2;
    my $editor = Test::MockObject->new;
    $editor->set_always('json_query', [{id => 123}]);

    my $original_hold = Test::MockObject->new;
    $original_hold->set_always('target', 456);
    my $desired_type = OILS_HOLD_TYPE_COPY;
    my $requestor_id = 1;
    my $ctx = OpenILS::Application::Circ::Holds::ChangeTypeContext->new(
        $original_hold,
        $desired_type,
        $requestor_id
    );
    my $target_query_builder = sub { {where => {abc => shift->original_target} } };

    $ctx->possible_targets($editor, $target_query_builder);
    $ctx->possible_targets($editor, $target_query_builder, {def => 789});

    is_deeply $editor->call_args_pos(1, 2),
        {where => {abc => 456}},
        'it can run the target query builder function ref';
    
    is_deeply $editor->call_args_pos(2, 2),
        {where => {abc => 456, def => 789}},
        'it can add extra where clauses';
};
