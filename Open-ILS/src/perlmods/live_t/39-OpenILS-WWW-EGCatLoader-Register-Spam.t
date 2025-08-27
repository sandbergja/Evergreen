use strict;
use warnings;
use OpenILS::Utils::TestUtils;
use OpenILS::Utils::Fieldmapper;
use OpenILS::Utils::CStoreEditor q/:funcs/;
use CGI;

my $script = OpenILS::Utils::TestUtils->new;
$script->bootstrap;
my $apputils = 'OpenILS::Application::AppUtils';

use Test::More tests => 3;

use_ok('OpenILS::WWW::EGCatLoader::Register::Spam');

subtest 'obvious spam', sub {
    plan tests => 2;

    # Data from the Enron Spam Data Set
    my $obvious_spam_usr = Fieldmapper::staging::user_stage->new;
    $obvious_spam_usr->home_ou(4);
    $obvious_spam_usr->first_given_name('need in softwar for your pc just visit our site we might have what you need best regard fallon');
    $obvious_spam_usr->second_given_name('hey how ya been long time no see');
    $obvious_spam_usr->family_name('adob macromedia o etc all in cd under');
    $obvious_spam_usr->usrname('to be remov from thi list click here');
    $obvious_spam_usr->row_id(1);

    my $obvious_spam_mailing = Fieldmapper::staging::mailing_address_stage->new;
    $obvious_spam_mailing->street1('plea read the attach file');
    $obvious_spam_mailing->city('lowest worldwid rate avail anywh on the net');
    $obvious_spam_mailing->state('click here to order today');
    $obvious_spam_mailing->post_code('need in softwar for your pc just visit our site we might have what you need best regard daniella');
    $obvious_spam_mailing->usrname('to be remov from thi list click here');
    $obvious_spam_mailing->country('thi file is bad');
    $obvious_spam_usr->row_id(5);

    my $settings = [];
    $ENV{HTTP_USER_AGENT} = 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0';
    my $cgi = CGI->new;
    my $editor = new_editor;
    $editor->init;

    my $spam = OpenILS::WWW::EGCatLoader::Register::Spam->new($obvious_spam_usr, $obvious_spam_mailing, $settings, $cgi, $editor);
    ok $spam, 'can instantiate a new spam checker';

    cmp_ok $spam->likelihood, '>', 0.5, 'it is more likely to be spam than non-spam';
};


subtest 'reasonable looking self-registration', sub {
    plan tests => 2;

    my $not_spam_usr = Fieldmapper::staging::user_stage->new;
    $not_spam_usr->home_ou(4);
    $not_spam_usr->first_given_name('Shiyali');
    $not_spam_usr->second_given_name('Ramamrita');
    $not_spam_usr->family_name('Ranganathan');
    $not_spam_usr->usrname('srr92');
    $not_spam_usr->row_id(1);

    my $not_spam_mailing = Fieldmapper::staging::mailing_address_stage->new;
    $not_spam_mailing->street1('373J+WFM, Ayothiya Nagar');
    $not_spam_mailing->city('Triplicane, Chennai');
    $not_spam_mailing->state('Tamil Nadu');
    $not_spam_mailing->post_code('600 005');
    $not_spam_mailing->usrname('srr92');
    $not_spam_mailing->country('India');
    $not_spam_mailing->row_id(5);

    my $settings = [];
    $ENV{HTTP_USER_AGENT} = 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0';
    my $cgi = CGI->new;
    my $editor = new_editor;
    $editor->init;

    my $spam = OpenILS::WWW::EGCatLoader::Register::Spam->new($not_spam_usr, $not_spam_mailing, $settings, $cgi, $editor);
    ok $spam, 'can instantiate a new spam checker';

    cmp_ok $spam->likelihood, '<', 0.5, 'it is more likely to be non-spam than spam';
};
