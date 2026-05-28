#!perl -T

use strict;
use warnings;

use Test::More tests => 3;
use Test::MockObject;

use OpenILS::Const qw/:const/;

use_ok 'OpenILS::Application::Circ::Holds::ChangeType';
use_ok 'OpenILS::Application::Circ::Holds::ChangeTypeContext';

subtest 'copy-to-volume query', sub {
    my $original_hold = Test::MockObject->new;
    $original_hold->set_always('target', 123);
    my $ctx = OpenILS::Application::Circ::Holds::ChangeTypeContext->new(
        $original_hold,
        'IGNORE_ME', # desired hold type
        456, # requestor id
    );

    my $query = OpenILS::Application::Circ::Holds::ChangeType::TARGET_QUERY_BUILDERS()
        ->{OILS_HOLD_TYPE_COPY()}
        ->{OILS_HOLD_TYPE_VOLUME()}
        ->($ctx);
    is_deeply $query,
        {from=>{acn=>'acp'},where=>{'+acp'=>{id=>123}}},
        'creates a json query with appropriate joins'
};

