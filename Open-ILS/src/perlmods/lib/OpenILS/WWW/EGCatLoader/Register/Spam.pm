package OpenILS::WWW::EGCatLoader::Register::Spam;

use warnings;
use strict;

use OpenILS::Utils::CStoreEditor qw/:funcs/;
use OpenSRF::Utils::Logger qw/$logger/;
use Duadua;
use List::Util qw(sum);

use constant BOT_USER_AGENT_SPAM_ADJUSTMENT => 0.4;
use constant HONEYPOT_SPAM_ADJUSTMENT => 0.8;
use constant BLOCK_LIST_SPAM_ADJUSTMENT => 1;
use constant NO_SPAM_ADJUSTMENT => 0;
use constant SPAM_FILTER_WEIGHT => 0.6;

sub new {
    my ($class, $user, $addr, $settings, $cgi, $editor) = @_;
    return bless({
        user => $user,
        addr => $addr,
        settings => $settings,
        cgi => $cgi,
        editor => $editor
    }, $class);
}

# Returns a number between 0 and 1.  If it is close to 1, we are very certain that
# it is spam.  If it is close to 0, we are very certain that it is a human user.
sub likelihood {
    my $self = shift;
    my $raw_likelihood = sum map { $self->$_ } @{ $self->adjustments };
    return 1 if $raw_likelihood > 1;
    return 0 if $raw_likelihood < 0;
    return $raw_likelihood;
}

sub adjustments {
    return [
        '_adjust_for_user_agent',
        '_adjust_for_honeypot',
        '_adjust_for_email_address_block',
        '_adjust_for_spam_filter'
    ];
}

# _adjust* methods: the contract for these methods is that they will consult
# class properties and return a number between -1 and 1 inclusive.  The results
# of all of these calculations will be summed to create the likelihood score.

# If the user agent is a known bot, this is likely spam.  While .4 is relatively
# likely, I didn't want to say that it is 100% definitely spam, just in case the
# patron is using some agentic AI doodad to help them fill out the form or something
# of that nature
sub _adjust_for_user_agent {
    my $self = shift;
    return Duadua->new($self->_user_agent)->is_bot ? BOT_USER_AGENT_SPAM_ADJUSTMENT : NO_SPAM_ADJUSTMENT;
}

# If the request filled out the honeypot field "request", they are almost certainly
# a bot, since that field is hidden from human users.
sub _adjust_for_honeypot {
    my $self = shift;
    return $self->{cgi}->param('request') ? HONEYPOT_SPAM_ADJUSTMENT : NO_SPAM_ADJUSTMENT;
}

# If the supplied email address has been blocked, they are a bot
# In theory, it would be nice to expose this as an OpenSRF method,
# but it would need to have a permissions check, which is tricky,
# since patrons doing self-registration would probably not be logged
# in.
sub _adjust_for_email_address_block {
    my $self = shift;
    my $email = $self->{user}->email();
    return NO_SPAM_ADJUSTMENT unless length($email);

    my $found = $self->{editor}->json_query({from => ['permission.blocks_for_email_address', $email]})->[0];
    return $found ? BLOCK_LIST_SPAM_ADJUSTMENT : NO_SPAM_ADJUSTMENT;
}

# Based on a statistical examination of the self-registration contents,
# how likely is it that this is spam?
sub _adjust_for_spam_filter {
    my $self = shift;
    my $spam_likelihood = $self->{editor}->json_query({from => [
        'staging.spam_likelihood',
        $self->_first_given_name,
        $self->_second_given_name,
        $self->_family_name,
        $self->_usrname,
        $self->_street1,
        $self->_city,
        $self->_post_code,
        $self->_country
    ]})->[0]->{'staging.spam_likelihood'};

    # Multiply the filter's reported spam likelihood by a number between 0.5 and 1.
    # This way, if the filter is very sure that it is spam, it can shape the overall score to
    # be more than 0.5.  However, if it is not as confident, other _adjust_* subroutines
    # will need to identify spam-like characteristics in order to get an overall score of
    # 0.5 or higher.
    return ($spam_likelihood * SPAM_FILTER_WEIGHT);
}


# Helper methods (getters and the like)

sub _user_agent {
    my $self = shift;
    return $ENV{HTTP_USER_AGENT} || '';
}

sub _first_given_name {
    my $self = shift;
    return $self->{user}->first_given_name();
}

sub _second_given_name {
    my $self = shift;
    return $self->{user}->second_given_name();
}

sub _family_name {
    my $self = shift;
    return $self->{user}->family_name();
}

sub _usrname {
    my $self = shift;
    return $self->{user}->usrname();
}

sub _street1 {
    my $self = shift;
    return $self->{addr}->street1();
}

sub _city {
    my $self = shift;
    return $self->{addr}->city();
}

sub _post_code {
    my $self = shift;
    return $self->{addr}->post_code();
}

sub _country {
    my $self = shift;
    return $self->{addr}->country();
}

1;
