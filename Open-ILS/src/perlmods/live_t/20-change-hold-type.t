#!perl
use strict;
use warnings;

use Test::More tests => 2;
diag("Testing changing hold types");

use List::Util qw/none/;

use OpenILS::Const qw/:const/;
use OpenILS::Utils::TestUtils;
use OpenILS::Application::AppUtils;
use OpenILS::Utils::CStoreEditor qw/:funcs/;

my $script = OpenILS::Utils::TestUtils->new;
my $U = 'OpenILS::Application::AppUtils';
my $e = new_editor;

$script->bootstrap;
$e->init;

use constant {
    STAFF_USERNAME => 'br2tcruz', # Tom Cruz
    STAFF_PASSWORD => 'demo123',
    STAFF_ID => 229,
    PATRON_ID => 145, # Gwendolyn Davenport
    ORG_UNIT_ID => 5, # BR2
    CALL_NUMBER_ID => 136,
    CALL_NUMBER_WITH_PART_ID => 919,
    ITEM_ID => 4205,
    ITEM_WITH_PART_ID => 3104,
    ITEM_WITH_PEER_BIBS => 3105,
    PART_ID => 5,
    TITLE_WITH_PART_ID => 53,
    METABIB_WITH_MULTIPLE_TITLES_ID => 241,
    TITLE_IDS_IN_METABIB => [245, 246, 247, 248],
};

my $authtoken = $script->authenticate({
    username => STAFF_USERNAME,
    password => STAFF_PASSWORD,
    type => 'staff'
});

my $staff = $e->retrieve_actor_user(STAFF_ID);

sub place_hold {
    my ($hold_type, $target) = @_;

    my $ahr = Fieldmapper::action::hold_request->new;
    $ahr->hold_type( $hold_type );
    $ahr->requestor( PATRON_ID );
    $ahr->pickup_lib( ORG_UNIT_ID );
    $ahr->target( $target );
    $ahr->usr( STAFF_ID );

    return $U->simplereq(
        'open-ils.circ',
        'open-ils.circ.holds.create',
        $authtoken,
        $ahr,
        {}
    );
}

sub cleanup {
    $e->xact_begin;
    $e->delete_action_hold_request(shift);
    $e->xact_commit;
    return;
}

subtest 'open-ils.circ.holds.change_type.possible_targets', sub {
    plan tests => 12;
    subtest 'when incorrect hold type is provided', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_COPY, ITEM_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            'I AM AN INCORRECT HOLD TYPE'
        );

        ok $U->is_event($results), 'returns an event';
        is $results->{textcode}, 'BAD_PARAMS', 'has text code BAD_PARAMS';

        cleanup($created_hold);
    };

    subtest 'copy to volume hold', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_COPY, ITEM_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_VOLUME
        );

        is scalar @{$results->{'allowed'}}, 1, 'found 1 potential allowed call number';
        is $results->{'allowed'}->[0]->label, 'FIC 223', 'found call number with the correct label';

        cleanup($created_hold);
    };

    subtest 'copy to part hold', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_COPY, ITEM_WITH_PART_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_MONOPART
        );

        is scalar @{$results->{'allowed'}}, 1, 'found 1 potential allowed part';
        is $results->{'allowed'}->[0]->label, 'DISC 4', 'found part with the correct label';

        cleanup($created_hold);
    };

    subtest 'copy to metabib hold when there are peer bibs', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_COPY, ITEM_WITH_PEER_BIBS);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_METARECORD
        );

        is scalar @{$results->{'allowed'}}, 5, 'found 5 potential allowed metarecords (1 from the call number and 4 from the peers)';
        is scalar @{$results->{'not_allowed'}}, 0, 'no metarecords that are not allowed';

        cleanup($created_hold);
    };

    subtest 'copy to title hold when there are peer bibs', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_COPY, ITEM_WITH_PEER_BIBS);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_TITLE
        );

        is scalar @{$results->{'allowed'}}, 5, 'found 5 potential allowed records (1 from the call number and 4 from the peers)';
        is scalar @{$results->{'not_allowed'}}, 0, 'no records that are not allowed';

        cleanup($created_hold);
    };

    subtest 'metarecord to title hold', sub {
        plan tests => 4;
        my $hold_id = place_hold(OILS_HOLD_TYPE_METARECORD, METABIB_WITH_MULTIPLE_TITLES_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_TITLE
        );

        is scalar @{$results->{'not_allowed'}}, 0, 'no parts that are not allowed';

        my @title_ids = sort map { $_->id } @{$results->{'allowed'}};
        is scalar @title_ids, 4, 'it finds the correct number of titles associated with the metarecord';
        is_deeply \@title_ids, TITLE_IDS_IN_METABIB, 'it includes the correct titles associated with the metarecord'; 
        cleanup($created_hold);
    };

    subtest 'metarecord to part hold', sub {
        plan tests => 2;
        my $hold_id = place_hold(OILS_HOLD_TYPE_METARECORD, TITLE_WITH_PART_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_MONOPART
        );

        is scalar @{$results->{'not_allowed'}}, 0, 'no parts that are not allowed';
        cleanup($created_hold);
    };

    subtest 'metarecord to copy hold', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_METARECORD, TITLE_WITH_PART_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_COPY
        );

        is scalar @{$results->{'allowed'}}, 14, 'found 14 copies';
        is scalar @{$results->{'not_allowed'}}, 0, 'no parts that are not allowed';
        cleanup($created_hold);
    };

    subtest 'part to title hold', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_MONOPART, PART_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_TITLE
        );

        is scalar @{$results->{'allowed'}}, 1, 'found 1 title';
        is $results->{'allowed'}->[0]->id, 53, 'it has the correct bre id!';

        cleanup($created_hold);
    };

    subtest 'volume to copy hold', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_VOLUME, CALL_NUMBER_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_COPY
        );

        is scalar @{$results->{'allowed'}}, 5, 'found 5 potential allowed items';
        is scalar @{$results->{'not_allowed'}}, 0, 'no items that are not allowed';

        cleanup($created_hold);
    };

    subtest 'volume to part hold', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_VOLUME, CALL_NUMBER_WITH_PART_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_MONOPART
        );

        is scalar @{$results->{'allowed'}}, 4, 'found all 4 parts that are on the title';
        is scalar @{$results->{'not_allowed'}}, 0, 'no parts that are not allowed';

        cleanup($created_hold);
    };

    subtest 'volume to title hold', sub {
        plan tests => 3;
        my $hold_id = place_hold(OILS_HOLD_TYPE_VOLUME, CALL_NUMBER_ID);
        my $created_hold = $e->retrieve_action_hold_request($hold_id);
        ok $created_hold, 'We can successfully find the hold we created in the db';

        my $results = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            $authtoken,
            $created_hold,
            OILS_HOLD_TYPE_TITLE
        );

        is scalar @{$results->{'allowed'}}, 1, 'found 1 title';
        is $results->{'allowed'}->[0]->id, 1, 'it has the correct bre id!';

        cleanup($created_hold);
    };
};


subtest 'open-ils.circ.holds.change_type.change', sub {
    plan tests => 1;
    subtest 'changing copy hold to volume hold', sub {
        plan tests => 5;
        my $hold_id = place_hold(OILS_HOLD_TYPE_COPY, ITEM_ID);
        my $original_hold = $e->retrieve_action_hold_request($hold_id);

        my $new_hold_id = $U->simplereq(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.change',
            $authtoken,
            $original_hold,
            OILS_HOLD_TYPE_VOLUME,
            1600
        );
        $original_hold = $e->retrieve_action_hold_request($hold_id);
        my $new_hold = $e->retrieve_action_hold_request($new_hold_id);

        ok $original_hold->cancel_time, 'original hold is canceled';
        ok $new_hold, 'created a new hold';
        ok !defined($new_hold->cancel_time), 'new hold is not canceled';
        is $new_hold->hold_type, OILS_HOLD_TYPE_VOLUME, 'new hold is a volume hold';
        is $new_hold->target, 1600, 'new hold has the correct volume';

        cleanup($original_hold);
        cleanup($new_hold);
    };
};
