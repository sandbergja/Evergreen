#!perl -T

use strict; use warnings;
use Test::More tests => 3;
use Test::MockObject;
use Test::MockModule;

use_ok 'OpenILS::Application::Search';
use_ok 'OpenILS::Application::Search::Biblio';

subtest 'record_id_to_copy_count' => sub {
    plan tests => 2;

    subtest 'when not metarecord and not staff' => sub {
        my $biblio_mock = Test::MockObject->new;
        $biblio_mock->set_always(api_name => 'open-ils.search.biblio.record.copy_count');

        my $apputils_mock = Test::MockModule->new('OpenILS::Application::AppUtils')
            ->redefine(cstorereq => sub {
                my ($self, $method, $criteria) = @_;
                is $method, 'open-ils.cstore.json_query.atomic', 'Calls the CStore json_query method';
                is_deeply
                    $criteria,
                    { from => ['asset.record_copy_count', 12, 123_456, 'f'] },
                    'Calls the asset.record_copy_count database function';
                return;
            });

        OpenILS::Application::Search::Biblio::record_id_to_copy_count(
            $biblio_mock, # self
            undef, # client
            12, # org id
            123_456 # record id
        );
    };

    subtest 'when metarecord and staff' => sub {
        my $biblio_mock = Test::MockObject->new;
        $biblio_mock->set_always(api_name => 'open-ils.search.biblio.metarecord.copy_count.staff');

        my $apputils_mock = Test::MockModule->new('OpenILS::Application::AppUtils')
            ->redefine(cstorereq => sub {
                my ($self, $method, $criteria) = @_;
                is $method, 'open-ils.cstore.json_query.atomic', 'Calls the CStore json_query method';
                is_deeply
                    $criteria,
                    { from => ['asset.metarecord_copy_count', 12, 123_456, 't'] },
                    'Calls the asset.metarecord_copy_count database function';
                return;
            });

        OpenILS::Application::Search::Biblio::record_id_to_copy_count(
            $biblio_mock, # self
            undef, # client
            12, # org id
            123_456 # record id
        );
    };
}
