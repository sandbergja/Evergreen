use strict;
use warnings;
use Test::More;
use OpenILS::Utils::TestUtils;
use OpenILS::Utils::CStoreEditor q/:funcs/;
use OpenILS::Utils::Fieldmapper;

my $script = OpenILS::Utils::TestUtils->new;
$script->bootstrap;
my $apputils = 'OpenILS::Application::AppUtils';

plan tests => 7;

$script->authenticate({
    username => 'admin',
    password => 'demo123',
    type => 'staff'
});
my $authtoken = $script->authtoken;
ok $authtoken, 'Got admin authtoken';

my $e = new_editor(authtoken => $authtoken);
$e->init;

my $org_unit_id = 6; # BR3

# Allow this org to accept pending users
my $setting_result = $apputils->simplereq(
    'open-ils.actor',
    'open-ils.actor.org_unit.settings.update',
    $authtoken,
    $org_unit_id,
    {'opac.allow_pending_user' => 1}
);
ok $setting_result, 'Enabled pending user creation for BR3';

subtest 'Basic User Stage Creation' => sub {
    plan tests => 3;

    my $user = Fieldmapper::staging::user_stage->new;
    $user->home_ou($org_unit_id);
    $user->first_given_name('My');
    $user->family_name('Test');
    $user->dob('2000-01-01');

    my $result = $apputils->simplereq(
        'open-ils.actor',
        'open-ils.actor.user.stage.create',
        $user
    );

    ok $result, 'Got a result from user stage creation';
    like $result, qr/^[\da-f-]+$/, 'Result looks like a UUID';

    # Verify the user was created in staging table
    my $created_user = $e->search_staging_user_stage({usrname => $result})->[0];
    ok $created_user, 'Found created user in staging table';
};

subtest 'User Stage with Addresses' => sub {
    plan tests => 3;

    my $user = Fieldmapper::staging::user_stage->new;
    $user->home_ou($org_unit_id);
    $user->first_given_name('Address');
    $user->family_name('Test');

    my $mailing = Fieldmapper::staging::mailing_address_stage->new;
    $mailing->street1('123 Test St');
    $mailing->city('Testville');
    $mailing->state('TS');
    $mailing->post_code('12345');

    my $billing = Fieldmapper::staging::billing_address_stage->new;
    $billing->street1('456 Bill St');
    $billing->city('Billtown');
    $billing->state('TS');
    $billing->post_code('67890');

    my $result = $apputils->simplereq(
        'open-ils.actor',
        'open-ils.actor.user.stage.create',
        $user, $mailing, $billing
    );

    ok $result, 'Created user with addresses';

    my $mail_addr = $e->search_staging_mailing_address_stage({usrname => $result})->[0];
    ok $mail_addr, 'Found mailing address';

    my $bill_addr = $e->search_staging_billing_address_stage({usrname => $result})->[0];
    ok $bill_addr, 'Found billing address';
};

subtest 'User Stage with Settings' => sub {
    plan tests => 2;

    my $user = Fieldmapper::staging::user_stage->new;
    $user->home_ou($org_unit_id);
    $user->first_given_name('Settings');
    $user->family_name('Test');

    my $setting = Fieldmapper::staging::setting_stage->new;
    $setting->setting('opac.default_search');
    $setting->value('title');

    my $result = $apputils->simplereq(
        'open-ils.actor',
        'open-ils.actor.user.stage.create',
        $user, undef, undef, [], [$setting]
    );

    ok $result, 'Created user with settings';

    my $saved_setting = $e->search_staging_setting_stage({usrname => $result})->[0];
    ok $saved_setting, 'Found saved setting';
};

subtest 'Duplicate Username Check' => sub {
    plan tests => 2;

    my $user1 = Fieldmapper::staging::user_stage->new;
    $user1->home_ou($org_unit_id);
    $user1->first_given_name('Duplicate');
    $user1->family_name('Test');
    $user1->usrname('duplicate_test_user');

    my $result1 = $apputils->simplereq(
        'open-ils.actor',
        'open-ils.actor.user.stage.create',
        $user1
    );

    ok $result1, 'Created first user';

    my $user2 = Fieldmapper::staging::user_stage->new;
    $user2->home_ou($org_unit_id);
    $user2->first_given_name('Duplicate2');
    $user2->family_name('Test');
    $user2->usrname('duplicate_test_user');

    my $result2 = $apputils->simplereq(
        'open-ils.actor',
        'open-ils.actor.user.stage.create',
        $user2
    );
    is $result2->{textcode}, 'USERNAME_EXISTS', 'Got USERNAME_EXISTS event';
};

subtest 'cleanup' => sub {
    my $test_staged_users = $e->search_staging_setting_stage({family_name => 'Test'});
    for my $user (@{$test_staged_users}) {
        $apputils->simplereq(
            'open-ils.actor',
            'open-ils.actor.user.stage.delete',
            $authtoken,
            $user->id
        );
    }
    $test_staged_users = $e->search_staging_setting_stage({family_name => 'Test'});
    is scalar(@{ $test_staged_users }), 0, 'Successfully deleted staged users';
}
