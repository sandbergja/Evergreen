use strict;
use warnings;
use OpenILS::Utils::Fieldmapper;
use CGI;
use Test::MockObject;

use Test::More tests => 6;

use_ok('OpenILS::WWW::EGCatLoader::Register::Spam');

my $user = Test::MockObject->new
    ->mock(first_given_name => sub { return 'Remedios'; })
    ->mock(family_name => sub { return 'Varo'; })
    ->mock(email => sub { return 'painter@gmail.com'; });


subtest('with a typical browser user agent', sub {
    plan tests => 2;
    my $addr = Test::MockObject->new;
    my $settings = [];
    $ENV{HTTP_USER_AGENT} = 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0';
    my $cgi = CGI->new;
    my $editor = Test::MockObject->new
        ->mock(json_query => sub { return [] });

    my $spam = OpenILS::WWW::EGCatLoader::Register::Spam->new($user, $addr, $settings, $cgi, $editor);
    ok $spam, 'can instantiate a new spam checker';

    is $spam->likelihood, 0, 'it says it is unlikely to be spam';
});

subtest('with a bot user agent', sub {
    plan tests => 3;
    my $addr = Test::MockObject->new;
    my $settings = [];
    $ENV{HTTP_USER_AGENT} = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)';
    my $cgi = CGI->new;
    my $editor = Test::MockObject->new
        ->mock(json_query => sub { return [] });

    my $spam = OpenILS::WWW::EGCatLoader::Register::Spam->new($user, $addr, $settings, $cgi, $editor);
    ok $spam, 'can instantiate a new spam checker';

    cmp_ok $spam->likelihood, '>', 0, 'the likelihood is greater than zero';
    cmp_ok $spam->likelihood, '<', 1, 'we are not yet 100% sure it is spam';
});

subtest('with the honeypot field filled and a typical browser user agent', sub {
    plan tests => 3;
    my $addr = Test::MockObject->new;
    my $settings = [];
    $ENV{HTTP_USER_AGENT} = 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0';
    my $cgi = CGI->new;
    $cgi->param('request', 'Please buy our excellent products!');
    my $editor = Test::MockObject->new
        ->mock(json_query => sub { return [] });


    my $spam = OpenILS::WWW::EGCatLoader::Register::Spam->new($user, $addr, $settings, $cgi, $editor);
    ok $spam, 'can instantiate a new spam checker';

    cmp_ok $spam->likelihood, '>', 0.5, 'it is more likely to be spam than non-spam';
    cmp_ok $spam->likelihood, '<', 1, 'we are not yet 100% sure it is spam';
});

subtest('with the honeypot field filled and a bot user agent', sub {
    plan tests => 2;
    my $addr = Test::MockObject->new;
    my $settings = [];
    $ENV{HTTP_USER_AGENT} = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)';
    my $cgi = CGI->new;
    $cgi->param('request', 'Please buy our excellent products!');
    my $editor = Test::MockObject->new
        ->mock(json_query => sub { return [] });

    my $spam = OpenILS::WWW::EGCatLoader::Register::Spam->new($user, $addr, $settings, $cgi, $editor);
    ok $spam, 'can instantiate a new spam checker';

    is $spam->likelihood, 1, 'it is extremely likely to be spam';
});

subtest('with an email domain on the block list', sub {
    plan tests => 2;
    my $blocked_domain_user = Test::MockObject->new
        ->mock(first_given_name => sub { return 'Remedios'; })
        ->mock(family_name => sub { return 'Varo'; })
        ->mock(email => sub { return 'abc123@163.com'; });
    my $addr = Test::MockObject->new;
    my $settings = [];
    $ENV{HTTP_USER_AGENT} = 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0';
    my $cgi = CGI->new;
    my $block_list_entry = Test::MockObject->new
        ->mock(address => sub { return '163.com'; })
        ->mock(type => sub { return 'domain'; });
    my $editor = Test::MockObject->new
        ->mock(json_query => sub { return [$block_list_entry] });

    my $spam = OpenILS::WWW::EGCatLoader::Register::Spam->new($blocked_domain_user, $addr, $settings, $cgi, $editor);
    ok $spam, 'can instantiate a new spam checker';

    is $spam->likelihood, 1, 'it is extremely likely to be spam';
});

