package OpenILS::Application::Circ::Holds::ChangeType;

use strict;
use warnings;

use base qw/OpenILS::Application/;

use OpenILS::Application::AppUtils;
use OpenILS::Application::Circ::Holds::ChangeTypeContext;
use OpenILS::Application::Circ::Holds::HoldsCommon;
use OpenILS::Const qw/:const/;
use OpenILS::Utils::CStoreEditor q/:funcs/;
use OpenSRF::Utils::Logger qw(:logger);

my $HC = 'OpenILS::Application::Circ::Holds::HoldsCommon';
my $U = 'OpenILS::Application::AppUtils';

use constant TARGET_QUERY_BUILDERS => {
    OILS_HOLD_TYPE_COPY() => {
        OILS_HOLD_TYPE_METARECORD() => sub {
            my $ctx = shift;
            return {from=>{mmr=>{mmrsm=>{join=>{bre=>{join=>{bpbcm=>{type=>'left'},acn=>{join=>'acp'}}}}}}},
                where=>{
                    '-or' => [
                        {'+bpbcm'=>{target_copy=>$ctx->original_target}},
                        {'+acp'=>{id=>$ctx->original_target}}
                    ]
                },
                distinct=>'true'
            }
        },
        OILS_HOLD_TYPE_MONOPART() => sub {
            my $ctx = shift;
            return {from=>{bmp=>'acpm'}, where=>{'+acpm'=>{target_copy=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_TITLE() => sub {
            my $ctx = shift;
            return {from=>{bre=>{bpbcm=>{type=>'left'},acn=>{join=>'acp'}}},
                where=>{
                    '-or' => [
                        {'+bpbcm'=>{target_copy=>$ctx->original_target}},
                        {'+acp'=>{id=>$ctx->original_target}}
                    ]
                },
                distinct=>'true'
            }
        },
        OILS_HOLD_TYPE_VOLUME() => sub {
            my $ctx = shift;
            return {from=>{acn=>'acp'}, where=>{'+acp'=>{id=>$ctx->original_target}}}
        },
    },
    OILS_HOLD_TYPE_METARECORD() => {
        OILS_HOLD_TYPE_COPY() => sub {
            my $ctx = shift;
            return {from=>{
                acp=>{acn=>{join=>{item_mr=>{class=>'mmrsm',field=>'source',fkey=>'record'}}},
                bpbcm=>{type=>'left', join=>{peer_bib_mr=>{class=>'mmrsm',field=>'source',fkey=>'peer_record',type=>'left'}}}}
            }, where=>{
                '-or' => [
                    {'+peer_bib_mr'=>{metarecord=>$ctx->original_target}},
                    {'+item_mr'=>{metarecord=>$ctx->original_target}}
                ]
            }}
        },
        OILS_HOLD_TYPE_MONOPART() => sub {
            my $ctx = shift;
            return {from=>{bmp=>{bre=>{join=>{mmrsm=>{field=>'source'}}}}},where=>{'+mmrsm'=>{metarecord=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_TITLE() => sub {
            my $ctx = shift;
            return {from=>{bre=>{mmrsm=>{field=>'source'}}}, where=>{'+mmrsm'=>{metarecord=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_VOLUME() => sub {
            my $ctx = shift;
            return {from=>{acn=>{mmrsm=>{field=>'source',fkey=>'record'}}}, where=>{'+mmrsm'=>{metarecord=>$ctx->original_target}}}
        },
    },
    OILS_HOLD_TYPE_MONOPART() => {
        OILS_HOLD_TYPE_COPY() => sub {
            my $ctx = shift;
            return {from=>{acp=>'acpm'}, where=>{'+acpm'=>{part=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_METARECORD() => sub {
            my $ctx = shift;
            return {from=>{mmr=>{mmrsm=>{join=>{bre=>{join=>'bmp'}}}}}, where=>{'+bmp'=>{id=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_TITLE() => sub {
            my $ctx = shift;
            return {from=>{bre=>'bmp'}, where=>{'+bmp'=>{id=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_VOLUME() => sub {
            my $ctx = shift;
            return {from=>{acn=>{bmp=>{fkey=>'record',field=>'record'}}}, where=>{'+bmp'=>{id=>$ctx->original_target}}}
        }
    },
    OILS_HOLD_TYPE_TITLE() => {
        OILS_HOLD_TYPE_COPY() => sub {
            my $ctx = shift;
            return {from=>{acp=>{acn=>{},bpbcm=>{type=>'left'}}}, where=>{'-or' => {
                '+acn'=>{record=>$ctx->original_target},
                '+bpbcm'=>{peer_record=>$ctx->original_target}
            }}
        }},
        OILS_HOLD_TYPE_METARECORD() => sub {
            my $ctx = shift;
            return {from=>{mmr=>'mmrsm'}, where=>{'+mmrsm'=>{source=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_MONOPART() => sub {
            my $ctx = shift;
            return {from=>{bmp=>'bre'}, where=>{'+bre'=>{id=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_VOLUME() => sub {
            my $ctx = shift;
            return {from=>'acn', where=>{record=>$ctx->original_target}}
        },
    },
    OILS_HOLD_TYPE_VOLUME() => {
        OILS_HOLD_TYPE_COPY() => sub {
            my $ctx = shift;
            return {from=>{acp=>'acn'}, where=>{call_number=>$ctx->original_target}}
        },
        OILS_HOLD_TYPE_METARECORD() => sub {
            my $ctx = shift;
            return {from=>{mmr=>{mmrsm=>{join=>{acn=>{fkey=>'source',field=>'record'}}}}}, where=>{'+acn'=>{id=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_MONOPART() => sub {
            my $ctx = shift;
            return {from=>{bmp=>{acn=>{fkey=>'record',field=>'record'}}}, where=>{'+acn'=>{id=>$ctx->original_target}}}
        },
        OILS_HOLD_TYPE_TITLE() => sub {
            my $ctx = shift;
            return {from=>{bre=>'acn'}, where=>{'+acn'=>{id=>$ctx->original_target}}}
        },
    }
};

use constant FM_CLASSES => {
    OILS_HOLD_TYPE_COPY() => Fieldmapper::class_for_hint('acp'),
    OILS_HOLD_TYPE_VOLUME() => Fieldmapper::class_for_hint('acn'),
    OILS_HOLD_TYPE_TITLE() => Fieldmapper::class_for_hint('bre'),
    OILS_HOLD_TYPE_METARECORD() => Fieldmapper::class_for_hint('mmr'),
    OILS_HOLD_TYPE_MONOPART() => Fieldmapper::class_for_hint('bmp'),
};

use constant REPLACED_WITH_ANOTHER_HOLD => 11;

__PACKAGE__->register_method(
    method    => 'possible_targets',
    api_name  => 'open-ils.circ.holds.change_type.possible_targets',
    stream => 1,
    signature => {
        desc => 'List of potential targets for changing the hold to the desired type.',
        params => [
            { desc => 'Authentication token', type => 'string' },
            { desc => 'Original hold (Fieldmapper object)', type => 'object'},
            { desc => 'Desired type (single character code)', type => 'string' },
            { desc => 'Extra where clauses', type => 'hashref'}
        ],
        return => {
            desc => 'Stream of fieldmapper objects on success, event on error',
        },
    }
);

sub possible_targets {
    my( $self, $conn, $auth, $original_hold, $desired_type, $extra_where_clauses ) = @_;
    my $editor = new_editor(authtoken=>$auth);
    return $editor->die_event unless $editor->checkauth;
    my $requestor_id = $editor->requestor->id;
    my $requestor_org_id = $editor->requestor->ws_ou;

    my $fieldmapper_class = FM_CLASSES->{$desired_type};
    return OpenILS::Event->new('BAD_PARAMS') unless defined $fieldmapper_class;
    return OpenILS::Event->new('BAD_PARAMS') unless $original_hold;

    my $ctx = OpenILS::Application::Circ::Holds::ChangeTypeContext->new(
        $original_hold,
        $desired_type,
        $requestor_id
    );
    my $target_query_builder = TARGET_QUERY_BUILDERS->{$ctx->original_type}->{$ctx->desired_type};
    return OpenILS::Event->new('BAD_PARAMS') unless defined $target_query_builder;
    my $patron = $editor->retrieve_actor_user( $ctx->patron_id ) or return $editor->event;
    return $editor->event unless $editor->allowed('VIEW_HOLD', $patron->home_ou);

    my $request_lib = $editor->retrieve_actor_org_unit( $requestor_org_id ) or return $editor->event;
    my $targets = $ctx->possible_targets($editor, $target_query_builder, $extra_where_clauses);
    return unless $targets;
    foreach (@{$targets}) {
        my @checked = $HC->do_possibility_checks(
            $editor,
            $patron,
            $request_lib,
            $ctx->selection_depth,
            %{$ctx->with_target_as_params($_->{$fieldmapper_class->Identity})}
        );
        if (@checked && $checked[0]) {
            my $fm_object = $fieldmapper_class->from_bare_hash($_);
            $conn->respond($fm_object);
        }
    }
    return undef;
}

__PACKAGE__->register_method(
    method    => 'change_type',
    api_name  => 'open-ils.circ.holds.change_type.change',
    signature => {
        desc => <<'END_DESCRIPTION',
            Change a hold to the desired type and target (if reasonable to do so).
            Internally, it places a new hold then cancels the old one.
END_DESCRIPTION
        params => [
            { desc => 'Authentication token', type => 'string' },
            { desc => 'Original hold (Fieldmapper object)', type => 'object'},
            { desc => 'New type (single character code)', type => 'string' },
            { desc => 'New target', type => 'primary key'},
            { desc => 'Optional: a json string of holdable formats', type => 'string'}
        ],
        return => {
            desc => 'New hold id on success, event on error',
        },
    }
);

sub change_type {
    my( $self, $conn, $auth, $original_hold, $new_type, $new_target, $new_holdable_formats ) = @_;
    my $editor = new_editor(authtoken=>$auth);
    return $editor->die_event unless $editor->checkauth;
    my $requestor_id = $editor->requestor->id;

    my $fieldmapper_class = FM_CLASSES->{$new_type};
    return OpenILS::Event->new('BAD_PARAMS') unless defined $fieldmapper_class;

    my $ctx = OpenILS::Application::Circ::Holds::ChangeTypeContext->new(
        $original_hold,
        $new_type,
        $requestor_id
    );
    my $target_query_builder = TARGET_QUERY_BUILDERS->{$ctx->original_type}->{$ctx->desired_type};
    return OpenILS::Event->new('BAD_PARAMS') unless defined $target_query_builder;
    my $patron = $editor->retrieve_actor_user( $ctx->patron_id ) or return $editor->event;
    return $editor->event unless $editor->allowed('VIEW_HOLD', $patron->home_ou);

    if (scalar @{$ctx->possible_targets($editor, $target_query_builder, {$fieldmapper_class->Identity => $new_target})}) {
        # Holdable formats are only possible for metarecord holds
        my $new_ahr = ($ctx->desired_type eq OILS_HOLD_TYPE_METARECORD) && $new_holdable_formats ?
            $ctx->with_target_as_ahr($new_target, {holdable_formats => $new_holdable_formats}) :
            $ctx->with_target_as_ahr($new_target);
        my ($hold_id) = $self->method_lookup(
            'open-ils.circ.holds.create'
            )->run($auth, $new_ahr);

        # open-ils.circ.holds.create can return a single event or an arrayref of events
        # In either case, we should return a single event.
        return $hold_id if $U->is_event($hold_id);
        if (ref $hold_id eq 'ARRAY') {
            my @events = grep {$U->is_event($_)} @{$hold_id};
            if (@events) {
                return $events[0];
            }
        }

        # Cancel the original hold now that a new hold has been created
        $original_hold->cancel_time('now');
        $original_hold->cancel_cause(REPLACED_WITH_ANOTHER_HOLD);
        $original_hold->canceled_by($editor->requestor->id);
        $original_hold->canceling_ws($editor->requestor->wsid);
        $editor->xact_begin;
        $editor->update_action_hold_request($original_hold) or return $editor->die_event;
        $editor->commit;
        return $hold_id;
    } else {
        return OpenILS::Event->new('BAD_PARAMS');
    }
}


1;
