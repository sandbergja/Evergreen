package OpenILS::Application::Actor::Stage;
use strict; use warnings;
use base 'OpenILS::Application';
use OpenILS::Application::AppUtils;
use OpenILS::Utils::CStoreEditor q/:funcs/;
use OpenSRF::Utils::Logger q/$logger/;
use OpenILS::Utils::Fieldmapper;
my $U = "OpenILS::Application::AppUtils";


__PACKAGE__->register_method (
    method      => 'create_user_stage',
    api_name    => 'open-ils.actor.user.stage.create',
    signature => {
        desc => q/
            Creates a new pending user account including addresses, statcats, and
            settings.
            Users are added to staging tables pending staff review.
        /,
        params => [
            {desc => 'user', type => 'object', class => 'stgu'},
            {desc => 'Mailing address.  Optional', type => 'object', class => 'stgma'},
            {desc => 'Billing address.  Optional', type => 'object', class => 'stgba'},
            {desc => 'Statcats.  Optional.  This is an array of "stgsc" objects', type => 'array'},
            {desc => 'Settings.  Optional.  This is an array of "stgs" objects', type => 'array'},
        ],
        return => {
            desc => 'username on success, Event on error',
            type => ''
        }

    }
);

sub create_user_stage {
    my($self, $conn, $user, $mail_addr, $bill_addr, $statcats, $settings) = @_; # more?

    return OpenILS::Event->new('BAD_PARAMS') unless $user;
    return 0 unless $U->ou_ancestor_setting_value($user->home_ou, 'opac.allow_pending_user');

    my $e = new_editor(xact => 1);

    my $uname = $user->usrname || $U->create_uuid_string;
    $user->usrname($uname);

    # see if this username is already taken
    return OpenILS::Event->new('USERNAME_EXISTS') if
        $e->search_staging_user_stage({usrname => $uname})->[0];

    $e->create_staging_user_stage($user) or return $e->die_event;

    if($mail_addr) {
        $mail_addr->usrname($uname);
        $e->create_staging_mailing_address_stage($mail_addr) or return $e->die_event;
    }

    if($bill_addr) {
        $bill_addr->usrname($uname);
        $e->create_staging_billing_address_stage($bill_addr) or return $e->die_event;
    }

    if($statcats) {
        foreach (@$statcats) {
            $_->usrname($uname);
            $e->create_staging_statcat_stage($_) or return $e->die_event;
        }
    }

    if($settings) {
        foreach (@$settings) {
            $_->usrname($uname);
            $e->create_staging_setting_stage($_) or return $e->die_event;
        }
    }

    $e->commit;
    $conn->respond_complete($uname);

    $U->create_events_for_hook('stgu.create', $user, $user->home_ou);
    return undef;
}

__PACKAGE__->register_method (
    method      => 'create_user_spam',
    api_name    => 'open-ils.actor.user.spam.create',
    signature => {
        desc => q/
            Creates a new entry in the spam tables including addresses, statcats, and
            settings.
        /,
        params => [
            {desc => 'user', type => 'object', class => 'stgu'},
            {desc => 'Mailing address.  Optional', type => 'object', class => 'stgma'},
            {desc => 'Billing address.  Optional', type => 'object', class => 'stgba'},
            {desc => 'Statcats.  Optional.  This is an array of "stgsc" objects', type => 'array'},
            {desc => 'Settings.  Optional.  This is an array of "stgs" objects', type => 'array'},
        ],
        return => {
            desc => '1 on success, Event on error'
        }

    }
);

sub create_user_spam {
    my($self, $conn, $user, $mail_addr, $bill_addr, $statcats, $settings) = @_;

    return OpenILS::Event->new('BAD_PARAMS') unless $user;

    # Re-bless all data as spam
    $user = bless $user, 'Fieldmapper::staging::spam_user_stage';
    if ($mail_addr) {
        $mail_addr = bless $mail_addr, 'Fieldmapper::staging::spam_mailing_address_stage';
    }
    if ($bill_addr) {
        $bill_addr = bless $bill_addr->properties, 'Fieldmapper::staging::spam_billing_address_stage';
    }
    if ($settings) {
        $settings = map { bless $_, 'Fieldmapper::staging::spam_setting_stage' } @{$settings};
    }


    my $e = new_editor(xact => 1);

    my $uname = $user->usrname || $U->create_uuid_string;
    $user->usrname($uname);

    $e->create_staging_spam_user_stage($user) or return $e->die_event;

    if($mail_addr) {
        $mail_addr->usrname($uname);
        $e->create_staging_spam_mailing_address_stage($mail_addr) or return $e->die_event;
    }

    if($bill_addr) {
        $bill_addr->usrname($uname);
        $e->create_staging_spam_billing_address_stage($bill_addr) or return $e->die_event;
    }

    if($statcats) {
        foreach (@$statcats) {
            $_->usrname($uname);
            $e->create_staging_spam_statcat_stage($_) or return $e->die_event;
        }
    }

    if($settings) {
        foreach (@$settings) {
            $_->usrname($uname);
            $e->create_spam_staging_setting_stage($_) or return $e->die_event;
        }
    }

    $e->commit;
    return 1;
}

__PACKAGE__->register_method (
    method      => 'user_stage_by_org',
    api_name    => 'open-ils.actor.user.stage.retrieve.by_org',
    stream      => 1
);

sub user_stage_by_org {
    my($self, $conn, $auth, $org_id, $limit, $offset) = @_;

    my $e = new_editor(authtoken => $auth);
    return $e->event unless $e->checkauth;
    $org_id ||= $e->requestor->ws_ou;
    return $e->event unless $e->allowed('VIEW_USER', $org_id);

    $limit ||= 100;
    $offset ||= 0;

    my $stage_ids = $e->search_staging_user_stage(
        [
            {   home_ou => $org_id, complete => 'f'}, 
            {   limit => $limit, 
                offset => $offset, 
                order_by => {stgu => 'row_id'}
            }
        ],
        {idlist => 1}
    );

    $conn->respond(flesh_user_stage($e, $_)) for @$stage_ids;
    return undef;
}

sub flesh_user_stage {
    my($e, $row_id) = @_;
    my $user = $e->retrieve_staging_user_stage($row_id) or return undef;
    return {
        user => $user,
        billing_addresses => $e->search_staging_billing_address_stage({usrname => $user->usrname}),
        mailing_addresses => $e->search_staging_mailing_address_stage({usrname => $user->usrname}),
        cards => $e->search_staging_card_stage({usrname => $user->usrname}),
        statcats => $e->search_staging_statcat_stage({usrname => $user->usrname}),
        settings => $e->search_staging_setting_stage({usrname => $user->usrname}),
    };
}


__PACKAGE__->register_method (
    method      => 'user_stage_by_uname',
    api_name    => 'open-ils.actor.user.stage.retrieve.by_username',
);

sub user_stage_by_uname {
    my($self, $conn, $auth, $username) = @_;

    my $e = new_editor(authtoken => $auth);
    return $e->event unless $e->checkauth;

    my $user = $e->search_staging_user_stage({
        usrname => $username, 
        complete => 'f'
    })->[0] or return $e->event;

    return $e->event unless $e->allowed('VIEW_USER', $user->home_ou);
    return flesh_user_stage($e, $user->row_id);
}




__PACKAGE__->register_method (
    method      => 'delete_user_stage', 
    api_name    => 'open-ils.actor.user.stage.delete',
);

sub delete_user_stage {
    my($self, $conn, $auth, $row_id) = @_;

    my $e = new_editor(authtoken => $auth, xact => 1);
    return $e->die_event unless $e->checkauth;
    my $data = flesh_user_stage($e, $row_id) or return $e->die_event;

    return $e->die_event unless $e->allowed('UPDATE_USER', $data->{user}->home_ou);

    $e->delete_staging_user_stage($data->{user}) or return $e->die_event;

    for my $addr (@{$data->{mailing_addresses}}) {
        $e->delete_staging_mailing_address_stage($addr) or return $e->die_event;
    }

    for my $addr (@{$data->{billing_addresses}}) {
        $e->delete_staging_billing_address_stage($addr) or return $e->die_event;
    }

    for my $card (@{$data->{cards}}) {
        $e->delete_staging_card_stage($card) or return $e->die_event;
    }

    for my $statcat (@{$data->{statcats}}) {
        $e->delete_staging_statcat_stage($statcat) or return $e->die_event;
    }

    for my $setting (@{$data->{settings}}) {
        $e->delete_staging_setting_stage($setting) or return $e->die_event;
    }

    $e->commit;
    return 1;
}

__PACKAGE__->register_method (
    method      => 'mark_stage_as_spam',
    api_name    => 'open-ils.actor.user.stage.mark_as_spam',
    signature => {
        desc => "Moves a patron self-registration from the staging area to the spam area",
        params => [
            {desc => 'Authentication token', type => 'string'},
            {desc => 'Row id of the staging.user_stage entry', type => 'number'},
        ],
        return => {desc => '1 on success, Event on error'}
    }
);

sub mark_stage_as_spam {
    my($self, $conn, $auth, $row_id) = @_;

    my $e = new_editor(authtoken => $auth);
    return $e->event unless $e->checkauth;

    return $e->event unless $e->allowed('MARK_SPAM') || $e->allowed('ADMIN_SPAM');
    $e->json_query({from => ['staging.mark_as_spam', $row_id]});
    return 1;
}

__PACKAGE__->register_method (
    method      => 'mark_stage_as_not_spam',
    api_name    => 'open-ils.actor.user.stage.mark_as_not_spam',
    signature => {
        desc => "Moves a patron self-registration from the spam area to the staging area",
        params => [
            {desc => 'Authentication token', type => 'string'},
            {desc => 'Row id of the staging.spam_user_stage entry', type => 'number'},
        ],
        return => {desc => '1 on success, Event on error'}
    }
);

sub mark_stage_as_not_spam {
    my($self, $conn, $auth, $row_id) = @_;

    my $e = new_editor(authtoken => $auth);
    return $e->event unless $e->checkauth;

    return $e->event unless $e->allowed('ADMIN_SPAM');
    $e->json_query({from => ['staging.mark_as_not_spam', $row_id]});
    return 1;
}


1;

