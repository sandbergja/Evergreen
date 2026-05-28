#!perl
use strict;
use warnings;

use Test::More tests => 2;

use OpenILS::Const qw/:const/;

use_ok( 'OpenILS::Application::Circ::Holds::HoldsCommon' );

my $HC = 'OpenILS::Application::Circ::Holds::HoldsCommon';

subtest 'target_field_name', sub {
    plan tests => 8;

    is $HC->target_field_name(OILS_HOLD_TYPE_COPY), 'copy_id',
        'correct target_field_name for COPY hold';
    is $HC->target_field_name(OILS_HOLD_TYPE_RECALL), 'copy_id',
        'correct target_field_name for RECALL hold';
    is $HC->target_field_name(OILS_HOLD_TYPE_FORCE), 'copy_id',
        'correct target_field_name for FORCE hold';
    is $HC->target_field_name(OILS_HOLD_TYPE_VOLUME), 'volume_id',
        'correct target_field_name for VOLUME hold';
    is $HC->target_field_name(OILS_HOLD_TYPE_MONOPART), 'partid',
        'correct target_field_name for MONOPART hold';
    is $HC->target_field_name(OILS_HOLD_TYPE_ISSUANCE), 'issuanceid',
        'correct target_field_name for ISSUANCE hold';
    is $HC->target_field_name(OILS_HOLD_TYPE_TITLE), 'titleid',
        'correct target_field_name for TITLE hold';
    is $HC->target_field_name('INCORRECT HOLD TYPE CODE'), undef,
        'returns undef when the hold type is not correct';
}
