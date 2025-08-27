package OpenILS::Application::Actor::SpamFilter;
use base 'OpenILS::Application';
use strict; use warnings;

use OpenILS::Utils::Fieldmapper;
use OpenILS::Utils::CStoreEditor qw/:funcs/;

__PACKAGE__->register_method (
    method      => 'spam_classifier_diagnostics',
    api_name    => 'open-ils.actor.spam_classifier_diagnostics',
    signature => {
        desc => 'Get diagnostic information about the spam classifier',
        params => [
            {desc => 'Authentication token', type => 'string'},
        ],
        return => {desc =>
            'hash with accuracy (floating point number) and array of measurement importances (floating point numbers) on success, Event on error'
        }
    }
);

sub spam_classifier_diagnostics {
    my($self, $conn, $auth) = @_;

    my $e = new_editor(authtoken => $auth);
    return $e->event unless $e->checkauth;
    return $e->event unless $e->allowed('ADMIN_SPAM');

    return $e->json_query({from => ['staging.spam_classifier_diagnostics']})->[0];
}

__PACKAGE__->register_method (
    method      => 'local_data_is_used_for_training',
    api_name    => 'open-ils.actor.local_data_is_used_for_training',
    signature => {
        desc => 'Check if we are using data from our local Evergreen to train the spam filter',
        params => [
            {desc => 'Authentication token', type => 'string'},
        ],
        return => {desc =>
            '1 if using local data, falsy if using the basic stock data, Event on error'
        }
    }
);

sub local_data_is_used_for_training {
    my($self, $conn, $auth) = @_;

    my $e = new_editor(authtoken => $auth);
    return $e->event unless $e->checkauth;
    return $e->event unless $e->allowed('ADMIN_SPAM');

    my $flag = $e->retrieve_config_global_flag('opac.spam_filter.use_local_data');
    return $flag ? $flag->enabled eq 't' : 0;
}

__PACKAGE__->register_method (
    method      => 'update_spam_training_data_set',
    api_name    => 'open-ils.actor.update_spam_training_data_set',
    signature => {
        desc => 'Update the data set used to train the spam filter',
        params => [
            {desc => 'Authentication token', type => 'string'},
            {desc => 'Source (local or stock)', type => 'string'},
        ],
        return => {desc =>
            '1 on success, Event on error'
        }
    }
);

sub update_spam_training_data_set {
    my($self, $conn, $auth, $source) = @_;

    my $e = new_editor(authtoken => $auth, xact => 1);
    return $e->event unless $e->checkauth;
    return $e->event unless $e->allowed('ADMIN_SPAM');

    my $desired_value;
    if ($source eq 'local') {
        $desired_value = 't';
    } elsif ($source eq 'stock') {
        $desired_value = 'f';
    } else {
        return OpenILS::Event->new('BAD_PARAMS');
    }

    my $flag = $e->retrieve_config_global_flag('opac.spam_filter.use_local_data');
    if ($flag->enabled eq $desired_value) {
        # no need to do anything, just return success
        return 1;
    }
    $flag->enabled($desired_value);
    $e->update_config_global_flag($flag) || return $e->event;
    $e->commit || return $e->event;
    return 1;
}

1;
