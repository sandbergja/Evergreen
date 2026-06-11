package OpenILS::Application::Circ::Holds::HoldsCommon;

use strict;
use warnings;

use OpenILS::Const qw/:const/;
use OpenILS::Utils::CStoreEditor q/:funcs/;
use OpenSRF::Utils::Logger qw(:logger);

my $U = "OpenILS::Application::AppUtils";

sub target_field_name {
    my ($class, $hold_type) = @_;
    if ($hold_type eq 'T') { return 'titleid'; }
    elsif ($hold_type eq 'C') { return 'copy_id'; }
    elsif ($hold_type eq 'R') { return 'copy_id'; }
    elsif ($hold_type eq 'F') { return 'copy_id'; }
    elsif ($hold_type eq 'I') { return 'issuanceid'; }
    elsif ($hold_type eq 'V') { return 'volume_id'; }
    elsif ($hold_type eq 'M') { return 'mrid'; }
    elsif ($hold_type eq 'P') { return 'partid'; }
    return;
}

sub do_possibility_checks {
    my($class, $e, $patron, $request_lib, $depth, %params) = @_;

    my $issuanceid   = $params{issuanceid}      || "";
    my $partid       = $params{partid}      || "";
    my $titleid      = $params{titleid}      || "";
    my $volid        = $params{volume_id};
    my $copyid       = $params{copy_id};
    my $mrid         = $params{mrid}         || "";
    my $pickup_lib   = $params{pickup_lib};
    my $hold_type    = $params{hold_type}    || 'T';
    my $selection_ou = $params{selection_ou} || $pickup_lib;
    my $holdable_formats = $params{holdable_formats};
    my $oargs        = $params{oargs}        || {};


    my $copy;
    my $volume;
    my $title;

    if( $hold_type eq OILS_HOLD_TYPE_FORCE || $hold_type eq OILS_HOLD_TYPE_RECALL || $hold_type eq OILS_HOLD_TYPE_COPY ) {

        return $e->event unless $copy   = $e->retrieve_asset_copy($copyid);
        return $e->event unless $volume = $e->retrieve_asset_call_number($copy->call_number);
        return $e->event unless $title  = $e->retrieve_biblio_record_entry($volume->record);

        return (1, 1, []) if( $hold_type eq OILS_HOLD_TYPE_RECALL || $hold_type eq OILS_HOLD_TYPE_FORCE);
        return verify_copy_for_hold(
            $patron, $e->requestor, $title, $copy, $pickup_lib, $request_lib, $oargs
        );

    } elsif( $hold_type eq OILS_HOLD_TYPE_VOLUME ) {

        return $e->event unless $volume = $e->retrieve_asset_call_number($volid);
        return $e->event unless $title  = $e->retrieve_biblio_record_entry($volume->record);

        return _check_volume_hold_is_possible(
            $volume, $title, $depth, $request_lib, $patron, $e->requestor, $pickup_lib, $selection_ou, $oargs
        );

    } elsif( $hold_type eq OILS_HOLD_TYPE_TITLE ) {

        return _check_title_hold_is_possible(
            $titleid, $depth, $request_lib, $patron, $e->requestor, $pickup_lib, $selection_ou, undef, $oargs
        );

    } elsif( $hold_type eq OILS_HOLD_TYPE_ISSUANCE ) {

        return _check_issuance_hold_is_possible(
            $issuanceid, $depth, $request_lib, $patron, $e->requestor, $pickup_lib, $selection_ou, $oargs
        );

    } elsif( $hold_type eq OILS_HOLD_TYPE_MONOPART ) {

        return _check_monopart_hold_is_possible(
            $partid, $depth, $request_lib, $patron, $e->requestor, $pickup_lib, $selection_ou, $oargs
        );

    } elsif( $hold_type eq OILS_HOLD_TYPE_METARECORD ) {

        # pasing undef as the depth to filtered_records causes the depth
        # of the selection_ou to be used, which is not what we want here.
        $depth ||= 0;

        my ($recs) = OpenSRF::Application->method_lookup('open-ils.circ.holds.metarecord.filtered_records')->run($mrid, $holdable_formats, $selection_ou, $depth);
        my @status = ();
        for my $rec (@$recs) {
            @status = _check_title_hold_is_possible(
                $rec, $depth, $request_lib, $patron, $e->requestor, $pickup_lib, $selection_ou, $holdable_formats, $oargs
            );
            last if $status[0];
        }
        return @status;
    }
#   else { Unrecognized hold_type ! }   # FIXME: return error? or 0?
}

my %prox_cache;
sub create_ranged_org_filter {
    my($e, $selection_ou, $depth) = @_;

    # find the orgs from which this hold may be fulfilled,
    # based on the selection_ou and depth

    my $top_org = $e->search_actor_org_unit([
        {parent_ou => undef},
        {flesh=>1, flesh_fields=>{aou=>['ou_type']}}])->[0];
    my %org_filter;

    return () if $depth == $top_org->ou_type->depth;

    my $org_list = $U->storagereq('open-ils.storage.actor.org_unit.descendants.atomic', $selection_ou, $depth);
    %org_filter = (circ_lib => []);
    push(@{$org_filter{circ_lib}}, $_->id) for @$org_list;

    $logger->info("hold org filter at depth $depth and selection_ou ".
        "$selection_ou created list of @{$org_filter{circ_lib}}");

    return %org_filter;
}


sub _check_title_hold_is_possible {
    my( $titleid, $depth, $request_lib, $patron, $requestor, $pickup_lib, $selection_ou, $holdable_formats, $oargs ) = @_;
    # $holdable_formats is now unused. We pre-filter the MR's records.

    my $e = new_editor();

    # T holds on records that have parts are normally OK, but if the record has
    # no non-part copies, the hold will ultimately fail, so let's test for that.
    #
    # If the global flag circ.holds.api_require_monographic_part_when_present is
    # enabled, then any configured parts for the bib is enough to disallow title holds.
    my $part_required = 0;
    my $parts = $e->search_biblio_monograph_part(
        {
            record => $titleid,
            deleted => 'f'
        }, {idlist=>1} );

    if (@$parts) {
        my $part_required_flag = $e->retrieve_config_global_flag('circ.holds.api_require_monographic_part_when_present');
        $part_required = ($part_required_flag and $U->is_true($part_required_flag->enabled));
        if (!$part_required) {
            my $np_copies = $e->json_query({
                select => { acp => [{column => 'id', transform => 'count', alias => 'count'}]},
                from => {acp => {acn => {}, acpm => {type => 'left'}}},
                where => {
                    '+acp' => {deleted => 'f'},
                    '+acn' => {deleted => 'f', record => $titleid},
                    '+acpm' => {id => undef}
                }
            });
            $part_required = 1 if $np_copies->[0]->{count} == 0;
        }
    }
    if ($part_required) {
        $logger->info("title hold when monographic part required");
        return (
            0, 0, [
                OpenILS::Event->new(
                    "TITLE_HOLD_WHEN_MONOGRAPHIC_PART_REQUIRED",
                    "payload" => {"fail_part" => "monographic_part_required"}
                )
            ]
        );
    }

    my %org_filter = create_ranged_org_filter($e, $selection_ou, $depth);

    # this monster will grab the id and circ_lib of all of the "holdable" copies for the given record
    my $copies = $e->json_query(
        {
            select => { acp => ['id', 'circ_lib'] },
              from => {
                acp => {
                    acn => {
                        field  => 'id',
                        fkey   => 'call_number',
                        filter => { record => $titleid }
                    },
                    acpl => {
                                field => 'id',
                                filter => { holdable => 't', deleted => 'f' },
                                fkey => 'location'
                            },
                    ccs  => { field => 'id', filter => { holdable => 't'}, fkey => 'status'   },
                    acpm => { field => 'target_copy', type => 'left' } # ignore part-linked copies
                }
            },
            where => {
                '+acp' => { circulate => 't', deleted => 'f', holdable => 't', %org_filter },
                '+acpm' => { target_copy => undef } # ignore part-linked copies
            }
        }
    );

    $logger->info("title possible found ".scalar(@$copies)." potential copies");
    return (
        0, 0, [
            OpenILS::Event->new(
                "HIGH_LEVEL_HOLD_HAS_NO_COPIES",
                "payload" => {"fail_part" => "no_ultimate_items"}
            )
        ]
    ) unless @$copies;

    # -----------------------------------------------------------------------
    # sort the copies into buckets based on their circ_lib proximity to
    # the patron's home_ou.
    # -----------------------------------------------------------------------

    my $home_org = $patron->home_ou;
    my $req_org = $request_lib->id;

    $prox_cache{$home_org} =
        $e->search_actor_org_unit_proximity({from_org => $home_org})
        unless $prox_cache{$home_org};
    my $home_prox = $prox_cache{$home_org};
    $logger->info("prox cache $home_org " . $prox_cache{$home_org});

    my %buckets;
    my %hash = map { ($_->to_org => $_->prox) } @$home_prox;
    push( @{$buckets{ $hash{$_->{circ_lib}} } }, $_->{id} ) for @$copies;

    my @keys = sort { $a <=> $b } keys %buckets;


    if( $home_org ne $req_org ) {
      # -----------------------------------------------------------------------
      # shove the copies close to the request_lib into the primary buckets
      # directly before the farthest away copies.  That way, they are not
      # given priority, but they are checked before the farthest copies.
      # -----------------------------------------------------------------------
        $prox_cache{$req_org} =
            $e->search_actor_org_unit_proximity({from_org => $req_org})
            unless $prox_cache{$req_org};
        my $req_prox = $prox_cache{$req_org};

        my %buckets2;
        my %hash2 = map { ($_->to_org => $_->prox) } @$req_prox;
        push( @{$buckets2{ $hash2{$_->{circ_lib}} } }, $_->{id} ) for @$copies;

        my $highest_key = $keys[-1];  # the farthest prox in the exising buckets
        my $new_key = $highest_key - 0.5; # right before the farthest prox
        my @keys2   = sort { $a <=> $b } keys %buckets2;
        for my $key (@keys2) {
            last if $key >= $highest_key;
            push( @{$buckets{$new_key}}, $_ ) for @{$buckets2{$key}};
        }
    }

    @keys = sort { $a <=> $b } keys %buckets;

    my $title;
    my %seen;
    my @status;
    my $age_protect_only = 0;
    OUTER: for my $key (@keys) {
      my @cps = @{$buckets{$key}};

      $logger->info("looking at " . scalar(@{$buckets{$key}}). " copies in proximity bucket $key");

      for my $copyid (@cps) {

         next if $seen{$copyid};
         $seen{$copyid} = 1; # there could be dupes given the merged buckets
         my $copy = $e->retrieve_asset_copy($copyid);
         $logger->debug("looking at bucket_key=$key, copy $copyid : circ_lib = " . $copy->circ_lib);

         unless($title) { # grab the title if we don't already have it
            my $vol = $e->retrieve_asset_call_number(
               [ $copy->call_number, { flesh => 1, flesh_fields => { bre => ['fixed_fields'], acn => ['record'] } } ] );
            $title = $vol->record;
         }

         @status = verify_copy_for_hold(
            $patron, $requestor, $title, $copy, $pickup_lib, $request_lib, $oargs);

         $age_protect_only ||= $status[3];
         last OUTER if $status[0];
      }
    }

    $status[3] = $age_protect_only;
    return @status;
}

sub _check_issuance_hold_is_possible {
    my( $issuanceid, $depth, $request_lib, $patron, $requestor, $pickup_lib, $selection_ou, $oargs ) = @_;

    my $e = new_editor();
    my %org_filter = create_ranged_org_filter($e, $selection_ou, $depth);

    # this monster will grab the id and circ_lib of all of the "holdable" copies for the given record
    my $copies = $e->json_query(
        {
            select => { acp => ['id', 'circ_lib'] },
              from => {
                acp => {
                    sitem => {
                        field  => 'unit',
                        fkey   => 'id',
                        filter => { issuance => $issuanceid }
                    },
                    acpl => {
                        field => 'id',
                        filter => { holdable => 't', deleted => 'f' },
                        fkey => 'location'
                    },
                    ccs  => { field => 'id', filter => { holdable => 't'}, fkey => 'status'   }
                }
            },
            where => {
                '+acp' => { circulate => 't', deleted => 'f', holdable => 't', %org_filter }
            },
            distinct => 1
        }
    );

    $logger->info("issuance possible found ".scalar(@$copies)." potential copies");

    my $empty_ok;
    if (!@$copies) {
        $empty_ok = $e->retrieve_config_global_flag('circ.holds.empty_issuance_ok');
        $empty_ok = ($empty_ok and $U->is_true($empty_ok->enabled));

        return (
            0, 0, [
                OpenILS::Event->new(
                    "HIGH_LEVEL_HOLD_HAS_NO_COPIES",
                    "payload" => {"fail_part" => "no_ultimate_items"}
                )
            ]
        ) unless $empty_ok;

        return (1, 0);
    }

    # -----------------------------------------------------------------------
    # sort the copies into buckets based on their circ_lib proximity to
    # the patron's home_ou.
    # -----------------------------------------------------------------------

    my $home_org = $patron->home_ou;
    my $req_org = $request_lib->id;

    $prox_cache{$home_org} =
        $e->search_actor_org_unit_proximity({from_org => $home_org})
        unless $prox_cache{$home_org};
    my $home_prox = $prox_cache{$home_org};
    $logger->info("prox cache $home_org " . $prox_cache{$home_org});

    my %buckets;
    my %hash = map { ($_->to_org => $_->prox) } @$home_prox;
    push( @{$buckets{ $hash{$_->{circ_lib}} } }, $_->{id} ) for @$copies;

    my @keys = sort { $a <=> $b } keys %buckets;


    if( $home_org ne $req_org ) {
      # -----------------------------------------------------------------------
      # shove the copies close to the request_lib into the primary buckets
      # directly before the farthest away copies.  That way, they are not
      # given priority, but they are checked before the farthest copies.
      # -----------------------------------------------------------------------
        $prox_cache{$req_org} =
            $e->search_actor_org_unit_proximity({from_org => $req_org})
            unless $prox_cache{$req_org};
        my $req_prox = $prox_cache{$req_org};

        my %buckets2;
        my %hash2 = map { ($_->to_org => $_->prox) } @$req_prox;
        push( @{$buckets2{ $hash2{$_->{circ_lib}} } }, $_->{id} ) for @$copies;

        my $highest_key = $keys[-1];  # the farthest prox in the exising buckets
        my $new_key = $highest_key - 0.5; # right before the farthest prox
        my @keys2   = sort { $a <=> $b } keys %buckets2;
        for my $key (@keys2) {
            last if $key >= $highest_key;
            push( @{$buckets{$new_key}}, $_ ) for @{$buckets2{$key}};
        }
    }

    @keys = sort { $a <=> $b } keys %buckets;

    my $title;
    my %seen;
    my @status;
    my $age_protect_only = 0;
    OUTER: for my $key (@keys) {
      my @cps = @{$buckets{$key}};

      $logger->info("looking at " . scalar(@{$buckets{$key}}). " copies in proximity bucket $key");

      for my $copyid (@cps) {

         next if $seen{$copyid};
         $seen{$copyid} = 1; # there could be dupes given the merged buckets
         my $copy = $e->retrieve_asset_copy($copyid);
         $logger->debug("looking at bucket_key=$key, copy $copyid : circ_lib = " . $copy->circ_lib);

         unless($title) { # grab the title if we don't already have it
            my $vol = $e->retrieve_asset_call_number(
               [ $copy->call_number, { flesh => 1, flesh_fields => { bre => ['fixed_fields'], acn => ['record'] } } ] );
            $title = $vol->record;
         }

         @status = verify_copy_for_hold(
            $patron, $requestor, $title, $copy, $pickup_lib, $request_lib, $oargs);

         $age_protect_only ||= $status[3];
         last OUTER if $status[0];
      }
    }

    if (!$status[0]) {
        if (!defined($empty_ok)) {
            $empty_ok = $e->retrieve_config_global_flag('circ.holds.empty_issuance_ok');
            $empty_ok = ($empty_ok and $U->is_true($empty_ok->enabled));
        }

        return (1,0) if ($empty_ok);
    }
    $status[3] = $age_protect_only;
    return @status;
}

sub _check_monopart_hold_is_possible {
    my( $partid, $depth, $request_lib, $patron, $requestor, $pickup_lib, $selection_ou, $oargs ) = @_;

    my $e = new_editor();
    my %org_filter = create_ranged_org_filter($e, $selection_ou, $depth);

    # this monster will grab the id and circ_lib of all of the "holdable" copies for the given record
    my $copies = $e->json_query(
        {
            select => { acp => ['id', 'circ_lib'] },
              from => {
                acp => {
                    acpm => {
                        field  => 'target_copy',
                        fkey   => 'id',
                        filter => { part => $partid }
                    },
                    acpl => {
                        field => 'id',
                        filter => { holdable => 't', deleted => 'f' },
                        fkey => 'location'
                    },
                    ccs  => { field => 'id', filter => { holdable => 't'}, fkey => 'status'   }
                }
            },
            where => {
                '+acp' => { circulate => 't', deleted => 'f', holdable => 't', %org_filter }
            },
            distinct => 1
        }
    );

    $logger->info("monopart possible found ".scalar(@$copies)." potential copies");

    my $empty_ok;
    if (!@$copies) {
        $empty_ok = $e->retrieve_config_global_flag('circ.holds.empty_part_ok');
        $empty_ok = ($empty_ok and $U->is_true($empty_ok->enabled));

        return (
            0, 0, [
                OpenILS::Event->new(
                    "HIGH_LEVEL_HOLD_HAS_NO_COPIES",
                    "payload" => {"fail_part" => "no_ultimate_items"}
                )
            ]
        ) unless $empty_ok;

        return (1, 0);
    }

    # -----------------------------------------------------------------------
    # sort the copies into buckets based on their circ_lib proximity to
    # the patron's home_ou.
    # -----------------------------------------------------------------------

    my $home_org = $patron->home_ou;
    my $req_org = $request_lib->id;

    $prox_cache{$home_org} =
        $e->search_actor_org_unit_proximity({from_org => $home_org})
        unless $prox_cache{$home_org};
    my $home_prox = $prox_cache{$home_org};
    $logger->info("prox cache $home_org " . $prox_cache{$home_org});

    my %buckets;
    my %hash = map { ($_->to_org => $_->prox) } @$home_prox;
    push( @{$buckets{ $hash{$_->{circ_lib}} } }, $_->{id} ) for @$copies;

    my @keys = sort { $a <=> $b } keys %buckets;


    if( $home_org ne $req_org ) {
      # -----------------------------------------------------------------------
      # shove the copies close to the request_lib into the primary buckets
      # directly before the farthest away copies.  That way, they are not
      # given priority, but they are checked before the farthest copies.
      # -----------------------------------------------------------------------
        $prox_cache{$req_org} =
            $e->search_actor_org_unit_proximity({from_org => $req_org})
            unless $prox_cache{$req_org};
        my $req_prox = $prox_cache{$req_org};

        my %buckets2;
        my %hash2 = map { ($_->to_org => $_->prox) } @$req_prox;
        push( @{$buckets2{ $hash2{$_->{circ_lib}} } }, $_->{id} ) for @$copies;

        my $highest_key = $keys[-1];  # the farthest prox in the exising buckets
        my $new_key = $highest_key - 0.5; # right before the farthest prox
        my @keys2   = sort { $a <=> $b } keys %buckets2;
        for my $key (@keys2) {
            last if $key >= $highest_key;
            push( @{$buckets{$new_key}}, $_ ) for @{$buckets2{$key}};
        }
    }

    @keys = sort { $a <=> $b } keys %buckets;

    my $title;
    my %seen;
    my @status;
    my $age_protect_only = 0;
    OUTER: for my $key (@keys) {
      my @cps = @{$buckets{$key}};

      $logger->info("looking at " . scalar(@{$buckets{$key}}). " copies in proximity bucket $key");

      for my $copyid (@cps) {

         next if $seen{$copyid};
         $seen{$copyid} = 1; # there could be dupes given the merged buckets
         my $copy = $e->retrieve_asset_copy($copyid);
         $logger->debug("looking at bucket_key=$key, copy $copyid : circ_lib = " . $copy->circ_lib);

         unless($title) { # grab the title if we don't already have it
            my $vol = $e->retrieve_asset_call_number(
               [ $copy->call_number, { flesh => 1, flesh_fields => { bre => ['fixed_fields'], acn => ['record'] } } ] );
            $title = $vol->record;
         }

         @status = verify_copy_for_hold(
            $patron, $requestor, $title, $copy, $pickup_lib, $request_lib, $oargs);

         $age_protect_only ||= $status[3];
         last OUTER if $status[0];
      }
    }

    if (!$status[0]) {
        if (!defined($empty_ok)) {
            $empty_ok = $e->retrieve_config_global_flag('circ.holds.empty_part_ok');
            $empty_ok = ($empty_ok and $U->is_true($empty_ok->enabled));
        }

        return (1,0) if ($empty_ok);
    }
    $status[3] = $age_protect_only;
    return @status;
}


sub _check_volume_hold_is_possible {
    my( $vol, $title, $depth, $request_lib, $patron, $requestor, $pickup_lib, $selection_ou, $oargs ) = @_;
    my %org_filter = create_ranged_org_filter(new_editor(), $selection_ou, $depth);
    my $copies = new_editor->search_asset_copy({call_number => $vol->id, %org_filter});
    $logger->info("checking possibility of volume hold for volume ".$vol->id);

    my $filter_copies = [];
    for my $copy (@$copies) {
        # ignore part-mapped copies for regular volume level holds
        push(@$filter_copies, $copy) unless
            new_editor->search_asset_copy_part_map({target_copy => $copy->id})->[0];
    }
    $copies = $filter_copies;

    return (
        0, 0, [
            OpenILS::Event->new(
                "HIGH_LEVEL_HOLD_HAS_NO_COPIES",
                "payload" => {"fail_part" => "no_ultimate_items"}
            )
        ]
    ) unless @$copies;

    my @status;
    my $age_protect_only = 0;
    for my $copy ( @$copies ) {
        @status = verify_copy_for_hold(
            $patron, $requestor, $title, $copy, $pickup_lib, $request_lib, $oargs );
        $age_protect_only ||= $status[3];
        last if $status[0];
    }
    $status[3] = $age_protect_only;
    return @status;
}

sub verify_copy_for_hold {
    my( $patron, $requestor, $title, $copy, $pickup_lib, $request_lib, $oargs ) = @_;
    # $oargs should be undef unless we're overriding.
    $logger->info("checking possibility of copy in hold request for copy ".$copy->id);
    my $permitted = OpenILS::Utils::PermitHold::permit_copy_hold(
        {
            patron           => $patron,
            requestor        => $requestor,
            copy             => $copy,
            title            => $title,
            title_descriptor => $title->fixed_fields,
            pickup_lib       => $pickup_lib,
            request_lib      => $request_lib,
            new_hold         => 1,
            show_event_list  => 1
        }
    );

    # Check for override permissions on events.
    if ($oargs && $permitted && scalar @$permitted) {
        # Remove the events from permitted that we can override.
        if ($oargs->{events}) {
            foreach my $evt (@{$oargs->{events}}) {
                $permitted = [grep {$_->{textcode} ne $evt} @{$permitted}];
            }
        }
        # Now, we handle the override all case by checking remaining
        # events against override permissions.
        if (scalar @$permitted && $oargs->{all}) {
            # Pre-set events and failed members of oargs to empty
            # arrays, if they are not set, yet.
            $oargs->{events} = [] unless ($oargs->{events});
            $oargs->{failed} = [] unless ($oargs->{failed});
            # When we're done with these checks, we swap permitted
            # with a reference to @disallowed.
            my @disallowed = ();
            foreach my $evt (@{$permitted}) {
                # Check if we've already seen the event in this
                # session and it failed.
                if (grep {$_ eq $evt->{textcode}} @{$oargs->{failed}}) {
                    push(@disallowed, $evt);
                } else {
                    # We have to check if the requestor has the
                    # override permission.

                    # AppUtils::check_user_perms returns the perm if
                    # the user doesn't have it, undef if they do.
                    if ($U->check_user_perms($requestor->id, $requestor->ws_ou, $evt->{textcode} . '.override')) {
                        push(@disallowed, $evt);
                        push(@{$oargs->{failed}}, $evt->{textcode});
                    } else {
                        push(@{$oargs->{events}}, $evt->{textcode});
                    }
                }
            }
            $permitted = \@disallowed;
        }
    }

    my $age_protect_only = 0;
    if (@$permitted == 1 && @$permitted[0]->{textcode} eq 'ITEM_AGE_PROTECTED') {
        $age_protect_only = 1;
    }

    return (
        (not scalar @$permitted), # true if permitted is an empty arrayref
        (   # XXX This test is of very dubious value; someone should figure
            # out what if anything is checking this value
            ($copy->circ_lib == $pickup_lib) and
            ($copy->status == OILS_COPY_STATUS_AVAILABLE)
        ),
        $permitted,
        $age_protect_only
    );
}

1;
