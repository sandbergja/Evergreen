#!perl -T

use strict; use warnings;
use Test::More tests => 4;
use Test::MockModule;
use Test::MockObject;
use CGI;

use_ok 'OpenILS::WWW::EGCatLoader';
use_ok 'OpenILS::WWW::EGCatLoader::Record';

my $editor_module = Test::MockModule->new('OpenILS::Utils::CStoreEditor')->mock('retrieve_actor_org_lasso', 0);

subtest 'get_hold_copy_summary' => sub {
    plan tests => 3;

    my $mock_session = _create_mock_search_session();
    my $utils = Test::MockModule->new('OpenILS::Application::AppUtils')
        ->redefine(simplereq => undef);
    my $record_id = 123_456;
    my $org = 108;

    subtest 'when staff' => sub {
        plan tests => 5;
        $mock_session->clear;
        my $mock_ctx = {
            is_staff => 1,
            org_within_hiding_scope => sub { return 0; }
        };
        my $cat_loader = _create_cat_loader($mock_ctx);

        $cat_loader->get_hold_copy_summary($record_id, $org);

        $mock_session->called_ok('request', 'request method called');
        $mock_session->called_args_pos_is(1, 2, 'open-ils.search.biblio.record.copy_count.staff', 'correct opensrf method called');
        $mock_session->called_args_pos_is(1, 3, $org, 'correct org unit id passed');
        $mock_session->called_args_pos_is(1, 4, $record_id, 'correct record id passed');
        is $cat_loader->ctx->{copy_summary_count_total}, 9, 'sets the copy_summary_count_total in the ctx object';
    };

    subtest 'when not staff' => sub {
        plan tests => 5;
        $mock_session->clear;
        my $mock_ctx = {
            is_staff => 0,
            org_within_hiding_scope => sub { return 0; }
        };
        my $cat_loader = _create_cat_loader($mock_ctx);

        $cat_loader->get_hold_copy_summary($record_id, $org);

        $mock_session->called_ok('request', 'request method called');
        $mock_session->called_args_pos_is(1, 2, 'open-ils.search.biblio.record.copy_count', 'correct opensrf method called');
        $mock_session->called_args_pos_is(1, 3, $org, 'correct org unit id passed');
        $mock_session->called_args_pos_is(1, 4, $record_id, 'correct record id passed');
        is $cat_loader->ctx->{copy_summary_count_total}, 9, 'sets the copy_summary_count_total in the ctx object';
    };

    subtest 'when the user has provided a valid lasso ID in the CGI params' => sub {
        plan tests => 5;
        $mock_session->clear;
        my $mock_ctx = {
            is_staff => 0,
            org_within_hiding_scope => sub { return 0; }
        };
        my $cat_loader = _create_cat_loader($mock_ctx);
        my $cgi = CGI->new;
        $cgi->param('locg', '9;lasso(2)');
        $cat_loader->cgi($cgi);
        my $editor = Test::MockObject->new;
        $editor->set_true('retrieve_actor_org_lasso');
        $cat_loader->editor( $editor );

        $cat_loader->get_hold_copy_summary($record_id, $org);

        $mock_session->called_ok('request', 'request method called');
        $mock_session->called_args_pos_is(1, 2, 'open-ils.search.biblio.record.copy_count', 'correct opensrf method called');
        $mock_session->called_args_pos_is(1, 3, -2, 'negated org lasso id passed rather than an org unit id');
        $mock_session->called_args_pos_is(1, 4, $record_id, 'correct record id passed');
        is $cat_loader->ctx->{copy_summary_count_total}, 9, 'sets the copy_summary_count_total in the ctx object';
    };
};

subtest 'get_negated_library_group_id' => sub {
    plan tests => 4;

    subtest 'when CGI does not have a lasso param' => sub {
        plan tests => 1;
        my $cat_loader = _create_cat_loader();

        is $cat_loader->get_negated_library_group_id, undef, 'it returns undef';
    };
    subtest 'when CGI has a non-numeric lasso param' => sub {
        plan tests => 1;
        my $cgi = CGI->new;
        my $cat_loader = _create_cat_loader();
        $cgi->param('locg', '9;lasso(grapefruit juice)');
        $cat_loader->cgi($cgi);

        is $cat_loader->get_negated_library_group_id, undef, 'it returns undef';
    };
    subtest 'when CGI has a lasso param that is not a lasso ID in the database' => sub {
        plan tests => 1;
        my $cgi = CGI->new;
        my $cat_loader = _create_cat_loader();
        $cgi->param('locg', '9;lasso(999999999)');
        $cat_loader->cgi($cgi);
        my $editor = Test::MockObject->new;
        $editor->set_false('retrieve_actor_org_lasso');
        $cat_loader->editor( $editor );

        is $cat_loader->get_negated_library_group_id, undef, 'it returns undef';
    };
    subtest 'when CGI has a valid lasso param' => sub {
        plan tests => 1;
        my $cat_loader = _create_cat_loader();
        my $cgi = CGI->new;
        $cgi->param('locg', '9;lasso(4)');
        $cat_loader->cgi($cgi);
        my $editor = Test::MockObject->new;
        $editor->set_true('retrieve_actor_org_lasso');
        $cat_loader->editor( $editor );

        is $cat_loader->get_negated_library_group_id,
            -4,
            'it returns the negated version of the lasso param';
    };
};

sub _create_mock_search_session {
    my $mock_session = Test::MockObject->new;
    $mock_session->fake_module('OpenSRF::AppSession', create => sub { return $mock_session });

    my @content = (
        {count => 3},
        {count => 5},
        {count => 1},
    );
    my $mock_response = Test::MockObject->new;
    my $mock_request = Test::MockObject->new;
    $mock_response->set_always('content', \@content);
    $mock_request->set_always('recv', $mock_response);
    $mock_session->set_always('request', $mock_request);
    $mock_session->set_true('kill_me');

    return $mock_session;
}

sub _create_cat_loader {
    my $ctx = shift || {};
    my $cat_loader = OpenILS::WWW::EGCatLoader->new(undef, $ctx);

    my $cgi = CGI->new;
    $cat_loader->cgi($cgi);
    return $cat_loader;
}
