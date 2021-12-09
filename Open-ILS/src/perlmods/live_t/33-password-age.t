#!perl
use constant FUTURE_DAYS => 150;
use strict; use warnings;
use Test::More tests => 4;
use OpenILS::Utils::TestUtils;
use OpenILS::Const qw(:const);
use OpenILS::Utils::CStoreEditor qw/:funcs/;
use OpenILS::Utils::Fieldmapper;
use DateTime;
use DateTime::Format::ISO8601;

diag("test password age");

my $U = 'OpenILS::Application::AppUtils';

my $script = OpenILS::Utils::TestUtils->new();
$script->bootstrap;

$script->authenticate({
    username => 'admin',
    password => 'demo123',
    type => 'staff'
});

my $authtoken = $script->authtoken;
ok($authtoken, 'was able to authenticate');

my $new_user = Fieldmapper::actor::user->new();
my $new_card = Fieldmapper::actor::card->new();

$new_card->barcode("lew_$$");
$new_card->id(-1); # virtual ID
$new_card->usr(undef);
$new_card->isnew(1);

$new_user->cards([ $new_card ]);
$new_user->card($new_card);
$new_user->usrname("lew_$$");
$new_user->passwd('lew_$$');
$new_user->family_name('Marshall');
$new_user->first_given_name('Llewellyn');
$new_user->profile(2);
$new_user->home_ou(4);
$new_user->ident_type(1);
$new_user->isnew(1);

my $resp = $U->simplereq(
    'open-ils.actor',
    'open-ils.actor.patron.update',
    $authtoken,
    $new_user
);

isa_ok($resp, 'Fieldmapper::actor::user', 'new patron');

my $new_id = $resp->id();

$resp = $U->simplereq(
    'open-ils.actor',
    'open-ils.actor.get_password_age',
    $authtoken,
    $new_id
);

cmp_ok($resp, '==', 0, 'Password age on new user is 0 days');

my $dt = DateTime->now();
 
$dt->add( days => FUTURE_DAYS );

$resp = $U->simplereq(
    'open-ils.actor',
    'open-ils.actor.get_password_age',
    $authtoken,
    $new_id,
    $dt->iso8601()
);

cmp_ok($resp, '==', FUTURE_DAYS, FUTURE_DAYS." days from now, Password age on new user is ".FUTURE_DAYS." days");

# clean up
$U->simplereq(
    'open-ils.actor',
    'open-ils.actor.user.delete',
    $authtoken,
    $new_id
);