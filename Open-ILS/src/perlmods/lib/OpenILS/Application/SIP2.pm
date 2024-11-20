package OpenILS::Application::SIP2;
use strict; use warnings;
use base 'OpenILS::Application';
use DateTime;
use DateTime::Format::ISO8601;
use OpenILS::Application;
use OpenILS::Event;
use OpenILS::Utils::Fieldmapper;
use OpenSRF::Utils::Logger qw(:logger);
use OpenILS::Utils::CStoreEditor qw/:funcs/;
use OpenILS::Application::AppUtils;
use OpenILS::Utils::DateTime qw/:datetime/;
use OpenILS::Application::SIP2::Common;
use OpenILS::Application::SIP2::Session;
use OpenILS::Application::SIP2::Item;
use OpenILS::Application::SIP2::Hold;
use OpenILS::Application::SIP2::Patron;
use OpenILS::Application::SIP2::Checkout;
use OpenILS::Application::SIP2::Checkin;
use OpenILS::Application::SIP2::Payment;
use OpenILS::Application::SIP2::Admin;

my $U = 'OpenILS::Application::AppUtils';
my $SC = 'OpenILS::Application::SIP2::Common';

__PACKAGE__->register_method(
    method    => 'dispatch_sip2_request',
    api_name  => 'open-ils.sip2.request', 
    api_level => 1,
    argc      => 2,
    signature => {
        desc     => q/
            Takes a SIP2 JSON message and handles the request/,
        params   => [{   
            name => 'seskey',
            desc => 'The SIP2 session key',
            type => 'string'
        }, {
            name => 'message',
            desc => 'SIP2 JSON message',
            type => q/SIP JSON object/
        }],
        return => {
            desc => q/SIP2 JSON message on success, Event on error/,
            type => 'object'
        }
    }
);

sub dispatch_sip2_request {
    my ($self, $client, $seskey, $message) = @_;
    OpenSRF::AppSession->ingress('sip2');

    return OpenILS::Event->new('SIP2_SESSION_REQUIRED') unless $seskey;
    my $msg_code = $message->{code};

    return handle_login($seskey, $message) if $msg_code eq '93';
    return handle_sc_status($seskey, $message) if $msg_code eq '99';

    # A cached session means we have successfully logged in with
    # the SIP credentials provided during a login request.  All
    # message types following require authentication.
    my $session = OpenILS::Application::SIPSession->find($seskey);

    if (!$session) {
        return {code => 'XT'} if $msg_code eq 'XS'; # end session signal
        return OpenILS::Event->new('SIP2_SESSION_REQUIRED');
    }

    my $MESSAGE_MAP = {
        '01' => \&handle_block,
        '09' => \&handle_checkin,
        '11' => \&handle_checkout,
        '15' => \&handle_hold,
        '17' => \&handle_item_info,
        '23' => \&handle_patron_status,
        '29' => \&handle_renew,
        '35' => \&handle_end_patron_session,
        '37' => \&handle_payment,
        '63' => \&handle_patron_info,
        '65' => \&handle_renew_all,
        '97' => \&handle_resend,
        'XS' => \&handle_end_session
    };

    return OpenILS::Event->new('SIP2_NOT_IMPLEMENTED', {payload => $message})
        unless exists $MESSAGE_MAP->{$msg_code};

    my $msg = $MESSAGE_MAP->{$msg_code}->($session, $message);

    # Scrub/replace values
    filter_response_message($session, $msg);

    if ($msg_code ne '97' && # Don't cache the resend response
        $session->config->{settings}->{support_acs_resend_messages}) {

        # If resend is supported, toss the last sent message for this
        # session into the cache.
        $SC->cache->put_cache("sip2_lastmsg_$seskey", $msg);
    }

    return $msg;
}

# Scrub and/or replace values in SIP fields based on SIP field 
# filter definitions.
#
# For Example:
#   Response: {'fields' => [{'AE' => 'Jane Doe'}, ...],'fixed_fields' => [...],'code' => '98'};
#   Filters: {'field' => [{'identifier' => 'AE', 'replace_with' => 'John Doe'}, ...]}
sub filter_response_message {
    my ($session, $response) = @_;

    my $session_filters = $session->filters;

    if (!$session_filters || !$response->{fields} || ref $response->{fields} ne 'ARRAY') {
        return;
    }

    sub find_field_config {
        my $filters = shift;
        my $field_id = shift;
        my @relavent_field_configs = grep { $_->identifier eq $field_id && $_->enabled eq 't' } @{ $filters };
        # since we can't do anything complicated yet, let's just return the first match
        return @relavent_field_configs ? $relavent_field_configs[0] : undef;
    }

    $response->{fields} = [
        grep {
            my $keep = 1;
            my @fids = keys(%{$_});
            my $fid = $fids[0];
            my $field_config = find_field_config( $session_filters, $fid );
            if ($field_config && $field_config->strip eq 't') {
                $keep = 0; # strip the entire field
            }
            $keep; # or not
        }
        map {
            my @fids = keys(%{$_});
            my $fid = $fids[0];
            my $field_config = find_field_config( $session_filters, $fid );
            $field_config && defined $field_config->replace_with
                ? { $fid => $field_config->replace_with }
                : $_;
        }
        @{ $response->{fields} }
    ];
}

sub handle_end_session {
    my ($session, $message) = @_;
    my $e = $session->editor;
    my $seskey = $session->seskey;
    my $resp = {code => 'XT'};

    $SC->cache->delete_cache("sip2_$seskey");

    $U->simplereq('open-ils.auth', 
        'open-ils.auth.session.delete', $e->authtoken);

    return $resp if $U->is_true($session->sip_account->transient);

    $e->xact_begin;
    my $ses = $e->retrieve_sip_session($seskey);
    if ($ses) {
        $e->delete_sip_session($ses);
        $e->commit;
    } else {
        $e->rollback;
    }

    return $resp;
}

# Login to Evergreen and cache the login data.
sub handle_login {
    my ($seskey, $message) = @_;
    my $e = new_editor();

    # Default to login-failed
    my $response = {code => '94', fixed_fields => ['0']};

    my $sip_username = $SC->get_field_value($message, 'CN');
    my $sip_password = $SC->get_field_value($message, 'CO');
    my $sip_account = $e->search_sip_account([
        {sip_username => $sip_username, enabled => 't'}, 
        {flesh => 1, flesh_fields => {sipacc => ['workstation']}}
    ])->[0];

    if (!$sip_account) {
        $logger->warn("SIP2: No such SIP account: $sip_username");
        return $response;
    }

    if ($U->verify_user_password($e, $sip_account->usr, $sip_password, 'sip2')) {
    
        my $session = OpenILS::Application::SIPSession->new(
            seskey => $seskey,
            sip_account => $sip_account
        );
        $response->{fixed_fields}->[0] = '1' if $session->set_ils_account;

    } else {
        $logger->info("SIP2: login failed for user=$sip_username")
    }

    return $response;
}

sub handle_sc_status {
    my ($seskey, $message) = @_;

    my $session = OpenILS::Application::SIPSession->find($seskey);

    my $config;

    my $here_org;

    if ($session) {
        $config = $session->config;
        my $org_id = $session->editor->requestor->ws_ou 
            || $session->editor->requestor->home_ou;

        $here_org = $session->editor->retrieve_actor_org_unit($org_id);

    } else {

        # Confirm sc-status-before-login is enabled before continuing.
        
        my $flag = new_editor()->search_config_global_flag({
            name => 'sip.sc_status_before_login_institution',
            value => {'!=' => undef},
            enabled => 't',
        })->[0];

        return OpenILS::Event->new(
            'SC_STATUS_REQUIRES_LOGIN', {payload => $message}) unless $flag;

        $config = {
            settings => {},
            institution => $flag->value,
            supports => OpenILS::Application::SIPSession->supports
        };
    }

    my @org_fields = $here_org ? 
        ({AM => $here_org->name}, {AN => $here_org->shortname}) : ();

    my $response = {
        code => '98',
        fixed_fields => [
            $SC->sipbool(1),    # online_status
            $SC->sipbool(1),    # checkin_ok
            $SC->sipbool(1),    # checkout_ok
            $SC->sipbool(1),    # acs_renewal_policy
            $SC->sipbool(0),    # status_update_ok
            $SC->sipbool(0),    # offline_ok
            '999',              # timeout_period
            '999',              # retries_allowed
            $SC->sipdate,       # transaction date
            '2.00'              # protocol_version
        ],
        fields => [
            {AO => $config->{institution}},
            @org_fields,
            {BX => join('', @{$config->{supports}})}
        ]
    }
}

sub handle_item_info {
    my ($session, $message) = @_;

    my $barcode = $SC->get_field_value($message, 'AB');
    my $config = $session->config;

    my $details = OpenILS::Application::SIP2::Item->get_item_details(
        $session, barcode => $barcode
    );

    if (!$details) {
        # No matching item found, return a minimal response.
        return {
            code => '18',
            fixed_fields => [
                '01', # circ status: other/Unknown
                '01', # security marker: other/unknown
                '01', # fee type: other/unknown
                $SC->sipdate
            ],
            fields => [{AB => $barcode, AJ => ''}]
        };
    };

    return {
        code => '18',
        fixed_fields => [
            $details->{circ_status},
            '02', # Security Marker, consistent with ../SIP*
            $details->{fee_type},
            $SC->sipdate
        ],
        fields => [
            {AB => $barcode},
            {AH => $details->{due_date}},
            {AJ => $details->{title}},
            {AP => $details->{current_loc}},
            {AQ => $details->{permanent_loc}},
            {BG => $details->{owning_loc}},
            {BH => $config->{settings}->{currency}},
            {BV => $details->{item}->deposit_amount},
            {CF => $details->{hold_queue_length}},
            {CK => $details->{media_type}},
            {CM => $details->{hold_pickup_date}},
            {CR => $details->{collection_code}},
            {CS => $details->{call_number}},
            {CT => $details->{destination_loc}},
            {CY => $details->{hold_patron_barcode}},
            $SC->asset_stat_cat_sip_fields($details->{item})
        ]
    };
}

sub handle_patron_info {
    my ($session, $message) = @_;
    my $sip_account = $session->sip_account;

    my $barcode = $SC->get_field_value($message, 'AA');
    my $password = $SC->get_field_value($message, 'AD');

    my $summary = 
        ref $message->{fixed_fields} ? $message->{fixed_fields}->[2] : '';

    my $list_items = $SC->patron_summary_list_items($summary);

    my $details = OpenILS::Application::SIP2::Patron->get_patron_details(
        $session,
        barcode => $barcode,
        password => $password,
        summary_start_item => $SC->get_field_value($message, 'BP'),
        summary_end_item => $SC->get_field_value($message, 'BQ'),
        summary_list_items => $list_items
    );

    my $response = 
        patron_response_common_data($session, $barcode, $password, $details);

    $response->{code} = '64';

    unless ($details) {
        push(
            @{$response->{fixed_fields}}, 
            $SC->count4(0), # holds_count
            $SC->count4(0), # overdue_count
            $SC->count4(0), # out_count
            $SC->count4(0), # fine_count
            $SC->count4(0), # recall_count
            $SC->count4(0), # unavail_holds_count
        );
        return $response;
    };

    my $patron = $details->{patron};

    push(
        @{$response->{fixed_fields}}, 
        $SC->count4($details->{holds_count}),
        $SC->count4($details->{overdue_count}),
        $SC->count4($details->{out_count}),
        $SC->count4($details->{fine_count}),
        $SC->count4($details->{recall_count}),
        $SC->count4($details->{unavail_holds_count})
    );

    push(
        @{$response->{fields}}, 
        {AQ => $patron->home_ou->shortname},
        {PA => $SC->sipymd($patron->expire_date)},
        {PB => $SC->sipymd($patron->dob, 1)},
        {PC => $patron->profile->name},
        {XI => $patron->id}
    );

    if ($list_items eq 'hold_items') {
        for my $hold (@{$details->{hold_items}}) {
            push(@{$response->{fields}}, {AS => $hold});
        }
    } elsif ($list_items eq 'charged_items') {
        for my $item (@{$details->{items_out}}) {
            push(@{$response->{fields}}, {AU => $item});
        }
    } elsif ($list_items eq 'overdue_items') {
        for my $item (@{$details->{overdue_items}}) {
            push(@{$response->{fields}}, {AT => $item});
        }
    } elsif ($list_items eq 'fine_items') {
        for my $item (@{$details->{fine_items}}) {
            push(@{$response->{fields}}, {AV => $item});
        }
    } elsif ($list_items eq 'unavailable_holds') {
        for my $item (@{$details->{unavailable_holds}}) {
            push(@{$response->{fields}}, {CD => $item});
        }
    }

    # NOTE: Recall Items (BU) is not supported.

    return $response;
}

sub handle_patron_status {
    my ($session, $message) = @_;

    my $barcode = $SC->get_field_value($message, 'AA');
    my $password = $SC->get_field_value($message, 'AD');

    my $details = OpenILS::Application::SIP2::Patron->get_patron_details(
        $session,
        barcode => $barcode,
        password => $password
    );

    my $response = patron_response_common_data(
        $session, $barcode, $password, $details);

    $response->{code} = '24';

    return $response;
}

# Patron Info and Patron Status responses share mostly the same data.
# This returns the base data which can be augmented as needed.
# Note we don't call Patron->get_patron_details here since different
# messages collect different amounts of data.
sub patron_response_common_data {
    my ($session, $barcode, $password, $details) = @_;

    if (!$details) {
        # No such user.  Return a stub response with all things denied.

        return {
            fixed_fields => [
                'Y' .  (' ' x 13),
                '000', # language
                $SC->sipdate
            ],
            fields => [
                {AO => $session->config->{institution}},
                {AA => $barcode},
                {AE => ''},
                {BL => $SC->sipbool(0)}, # valid patron
                {CQ => $SC->sipbool(0)}  # valid patron password
            ]
        };
    }

    my $patron = $details->{patron};

    # SIP/JSON clients treat the patron status string as a single
    # fixed field entry.
    my $status = 
          $SC->spacebool($details->{charge_denied})
        . $SC->spacebool($details->{renew_denied})
        . $SC->spacebool($details->{recall_denied})
        . $SC->spacebool($details->{holds_denied})
        . $SC->spacebool($patron->card->active eq 'f')
        . $SC->spacebool(0) # too many charged
        . $SC->spacebool($details->{too_may_overdue})
        . $SC->spacebool(0) # too many renewals
        . $SC->spacebool(0) # too many claims retruned
        . $SC->spacebool(0) # too many lost
        . $SC->spacebool($details->{too_many_fines})
        . $SC->spacebool($details->{too_many_fines})
        . $SC->spacebool(0) # recall overdue
        . $SC->spacebool($details->{too_many_fines})
        ;

    return {
        fixed_fields => [
            $status,
            '000', # language
            $SC->sipdate
        ],
        fields => [
            {AA => $barcode},
            {AE => sprintf('%s %s %s',
                   ($patron->first_given_name || ''),
                   ($patron->second_given_name || ''),
                   ($patron->family_name || ''))},
            {AO => $session->config->{institution}},
            {BH => $session->config->{settings}->{currency}},
            {BL => $SC->sipbool(1)},          # valid patron
            {BV => $details->{balance_owed}}, # fee amount
            {CQ => $SC->sipbool($details->{valid_patron_password})},
            {BD => $details->{patron_address}},
            {BE => $patron->email},
            {BF => $details->{patron_phone}},
            {PI => $patron->net_access_level ? $patron->net_access_level->name : ''},
            $SC->actor_stat_cat_sip_fields($patron),
        ]
    };
}

sub handle_block {
    my ($session, $message) = @_;

    my $patron_barcode = $SC->get_field_value($message, 'AA');
    my $blocked_card_msg = $SC->get_field_value($message, 'AL');

    my $blocked = OpenILS::Application::SIP2::Patron->block_patron(
        $session, $patron_barcode, $blocked_card_msg);

    # SIP message 01 wants a message 24 (patron status) response.
    return handle_patron_status($session, $message);
}

sub handle_checkout {
    my ($session, $message) = @_;
    return checkout_renew_common($session, $message);
}

sub handle_renew {
    my ($session, $message) = @_;
    return checkout_renew_common($session, $message, 1);
}

sub checkout_renew_common {
    my ($session, $message, $is_renew_request) = @_;
    my $config = $session->config;

    my $patron_barcode = $SC->get_field_value($message, 'AA');
    my $item_barcode = $SC->get_field_value($message, 'AB');
    my $fee_ack = $SC->get_field_value($message, 'BO');

    my $code = $is_renew_request ? '30' : '12';
    my $stub = {
        code => $code,
        fixed_fields => [
            0,                  # checkout ok
            $SC->sipbool(0),    # renewal ok
            $SC->sipbool(0),    # magnetic media
            $SC->sipbool(0),    # desensitize
            $SC->sipdate,       # transaction date
        ],
        fields => [
            {AA => $patron_barcode},
            {AB => $item_barcode},
            {AO => $config->{institution}},
            {AH => ''}
        ]
    };

    my $item_details = OpenILS::Application::SIP2::Item->get_item_details(
        $session, barcode => $item_barcode);
    push @{ $stub->{fields} }, {AJ => ($item_details->{title} || '')};

    return $stub unless $item_details && keys %{ $item_details };

    my $patron_details = OpenILS::Application::SIP2::Patron->get_patron_details(
        $session, barcode => $patron_barcode);
    
    return $stub unless $patron_details;

    my $is_renewal = $is_renew_request;
    my $renew_allowed = $message->{fixed_fields}->[0] eq 'Y';

    if (!$is_renewal && $renew_allowed) {
        # A checkout can become a renewal if the checkout request allows
        # it and the item in question is currently checked out to the
        # patron making the request.
        if (my $circ = $item_details->{circ}) {
            $is_renewal = $circ->usr->id == $patron_details->{patron}->id;
        }
    }

    my $circ_details = OpenILS::Application::SIP2::Checkout->checkout(
        $session, 
        patron_barcode => $patron_barcode, 
        item_barcode => $item_barcode,
        fee_ack => $fee_ack,
        is_renew => $is_renewal
    );

    my $magnetic = $item_details->{magnetic_media};
    my $circ = $circ_details->{circ};

    my $can_renew = 0;
    if ($circ) {
        $can_renew = !$patron_details->{renew_denied} 
            && $circ->renewal_remaining > 0;
    }

    my $already_out_to_patron = $item_details->{circ}
        ? $item_details->{circ}->usr->id == $patron_details->{patron}->id
        : 0;

    return {
        code => $code,
        fixed_fields => [
            $circ ? 1 : 0, # checkout ok

            # Per SIP spec, "renewal ok" is a bit dumber than
            # $can_renew, and returns Y if the item was already
            # circulating to the patron, N otherwise)
            $SC->sipbool($already_out_to_patron),

            $SC->sipbool($magnetic), # magnetic media
            $SC->sipbool($is_renewal ? 0 : !$magnetic), # desensitize
            $SC->sipdate,
        ],
        fields => [
            {AA => $patron_barcode},
            {AB => $item_barcode},
            {AJ => $item_details->{title}},
            {AO => $config->{institution}},
            {BT => $item_details->{fee_type}},
            {CI => 'N'}, # security inhibit
            {CK => $item_details->{media_type}},
            {AF => $circ_details->{screen_msg}},
            {AH => $circ_details->{due_date}},
            {BK => $circ ? $circ->id : ''},
            {BV => $item_details->{item}->deposit_amount}
        ]
    };
}

sub handle_renew_all {
    my ($session, $message) = @_;
    my $config = $session->config;

    my $patron_barcode = $SC->get_field_value($message, 'AA');
    my $patron_password = $SC->get_field_value($message, 'AD');
    my $fee_ack = $SC->get_field_value($message, 'BO');

    my $stub = {
        code => '66',
        fixed_fields => [
            0,              # ok
            $SC->count4(0), # renewed count
            $SC->count4(0), # unrenewed count
            $SC->sipdate,   # transaction date
        ],
        fields => [
            {AA => $patron_barcode},
            {AO => $config->{institution}},
        ]
    };

    my $patron_details = OpenILS::Application::SIP2::Patron->get_patron_details(
        $session, barcode => $patron_barcode, password => $patron_password);

    return $stub unless $patron_details;

    my $circ_details = OpenILS::Application::SIP2::Checkout->renew_all(
        $session, $patron_details, fee_ack => $fee_ack
    );

    my $screen_msg = $circ_details->{screen_msg};
    my @renewed = @{$circ_details->{items_renewed}};
    my @unrenewed = @{$circ_details->{items_unrenewed}};

    return {
        code => '66',
        fixed_fields => [
            1, # ok
            $SC->count4(scalar(@renewed)),
            $SC->count4(scalar(@unrenewed)),
            $SC->sipdate,
        ],
        fields => [
            {AA => $patron_barcode},
            {AO => $config->{institution}},
            @{ [ map { {BM => $_} } @renewed ] },
            @{ [ map { {BN => $_} } @unrenewed ] },
            {AF => $screen_msg}
        ]
    };
}


sub handle_checkin {
    my ($session, $message) = @_;
    my $config = $session->config;

    my @fixed_fields = @{$message->{fixed_fields} || []};

    my $item_barcode = $SC->get_field_value($message, 'AB');
    my $current_loc = $SC->get_field_value($message, 'AP');
    my $return_date = $fixed_fields[2];

    my $stub = {
        code => '10',
        fixed_fields => [
            0,                  # checkin ok
            $SC->sipbool(0),    # resensitize
            $SC->sipbool(0),    # magnetic media
            'N',                # alert
            $SC->sipdate,       # transaction date
        ],
        fields => [
            {AB => $item_barcode},
            {AO => $config->{institution}},
            {CV => '00'} # unkown alert type
        ]
    };

    my $item_details = OpenILS::Application::SIP2::Item->get_item_details(
        $session, barcode => $item_barcode);

    return $stub unless $item_details;

    my $checkin_details = OpenILS::Application::SIP2::Checkin->checkin(
        $session, 
        item_barcode => $item_barcode,
        current_loc => $current_loc,
        item_details => $item_details,
        return_date => $return_date
    );

    my $magnetic = $item_details->{magnetic_media};

    return {
        code => '10',
        fixed_fields => [
            $checkin_details->{ok},                     # checkin ok
            $SC->sipbool(!$magnetic),                   # resensitize
            $SC->sipbool($magnetic),                    # magnetic media
            $SC->sipbool($checkin_details->{alert}),    # alert
            $SC->sipdate,                               # transaction date
        ],
        fields => [
            {AA => $checkin_details->{patron_barcode}},
            {AB => $item_barcode},
            {AJ => $item_details->{title}},
            {AO => $config->{institution}},
            {AP => $checkin_details->{current_loc}},
            {AQ => $checkin_details->{permanent_loc}},
            {BF => $checkin_details->{hold_patron_phone}},
            {BG => $item_details->{owning_loc}},
            {BT => $item_details->{fee_type}},
            {CI => 0}, # security inhibit
            {CK => $item_details->{media_type}},
            {CR => $item_details->{collection_code}},
            {CS => $item_details->{call_number}},
            {CV => $checkin_details->{alert_type}},
            {AF => $checkin_details->{screen_msg}},
            {CT => $checkin_details->{destination_loc}},
            {CY => $checkin_details->{hold_patron_barcode}},
            {DA => $checkin_details->{hold_patron_name}},
        ]
    };
}

sub handle_hold {
    my ($session, $message) = @_;
    my $config = $session->config;

    my @fixed_fields = @{$message->{fixed_fields} || []};
    my $hold_mode = $fixed_fields[0];

    my $patron_barcode = $SC->get_field_value($message, 'AA');
    my $item_barcode = $SC->get_field_value($message, 'AB');

    my $stub = {
        code => '16',
        fixed_fields => [
             0 , # ok field
            'N', # available field
            $SC->sipdate
        ],
        fields => [
            {AA => $patron_barcode},
            {AB => $item_barcode},
            {AO => $config->{institution}}
        ]
    };

    # Hold Cancel is the only supported action.
    return $stub unless $hold_mode eq '-';

    my $patron_details = 
        OpenILS::Application::SIP2::Patron->get_patron_details(
        $session, barcode => $patron_barcode);

    return $stub unless $patron_details;

    my $item_details = OpenILS::Application::SIP2::Item->get_item_details(
        $session, barcode => $item_barcode);

    return $stub unless $item_details;

    my $hold = OpenILS::Application::SIP2::Hold->hold_from_copy(
        $session, $patron_details, $item_details);

    return $stub unless $hold;

    my $details = OpenILS::Application::SIP2::Hold->cancel($session, $hold);

    return $stub unless $details->{ok};
    
    # report info on the targeted copy if one is set.
    my $copy = $hold->current_copy || $item_details->{item};
    my $title_id = $item_details->{item}->call_number->record->id;

    return {
        code => '16',
        fixed_fields => [
             1 , # ok field
            'N', # available field
            $SC->sipdate
        ],
        fields => [
            {AA => $patron_barcode},
            {AB => $copy->barcode},
            {AJ => $title_id},
            {AO => $config->{institution}}
        ]
    };
}

sub handle_payment {
    my ($session, $message) = @_;
    my $config = $session->config;

    my @fixed_fields = @{$message->{fixed_fields} || []};

    my $fee_type = $fixed_fields[1];
    my $pay_type = $fixed_fields[2];
    my $pay_amount = $SC->get_field_value($message, 'BV');
    my $patron_barcode = $SC->get_field_value($message, 'AA');
    my $fee_id = $SC->get_field_value($message, 'CG');
    my $terminal_xact = $SC->get_field_value($message, 'BK');

    # Envisionware extensions for relaying information about 
    # payments made via credit card kiosk or cash register.
    my $register_login = $SC->get_field_value($message, 'OR');
    my $check_number = $SC->get_field_value($message, 'RN');

    my $details = OpenILS::Application::SIP2::Payment->apply_payment(
        $session, 
        fee_id => $fee_id,
        fee_type => $fee_type,
        pay_type => $pay_type,
        pay_amount => $pay_amount,
        check_number => $check_number,
        patron_barcode => $patron_barcode,
        terminal_xact => $terminal_xact,
        register_login => $register_login
    );

    return {
        code => '38',
        fixed_fields => [
            $SC->sipbool($details->{ok}),
            $SC->sipdate,
        ],
        fields => [
            {AA => $patron_barcode},
            {AO => $config->{institution}},
            {AF => $details->{screen_msg}}
        ]
    }
}

sub handle_end_patron_session {
    my ($session, $message) = @_;
    my $config = $session->config;

    # we don't actually do anything real with this :-)

    return {
        code => '36',
        fixed_fields => [
            $SC->sipbool(1),
            $SC->sipdate
        ],
        fields => [
            {AO => $config->{institution}},
            {AA => $SC->get_field_value($message, 'AA')}
        ]
    }
}

sub handle_resend {
    my ($session, $message) = @_;
    my $seskey = $session->seskey;

    return OpenILS::Event->new('SIP2_NOT_IMPLEMENTED') unless 
        $session->config->{settings}->{support_acs_resend_messages};

    return $SC->cache->get_cache("sip2_lastmsg_$seskey");
}

1;

