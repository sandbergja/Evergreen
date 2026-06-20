package OpenILS::Application::Circ::Holds::ChangeTypeContext;

use strict;
use warnings;

use OpenILS::Const qw/:const/;
use OpenILS::Application::Circ::Holds::HoldsCommon;

my $HC = 'OpenILS::Application::Circ::Holds::HoldsCommon';

sub new {
    my ($class, $original_hold, $desired_type, $requestor_id) = @_;
    return bless {
        original_hold => $original_hold,
        desired_type => $desired_type,
        requestor_id => $requestor_id
    }, $class;
}

sub requestor_id { return shift->{requestor_id}; }
sub desired_type { return shift->{desired_type}; }
sub original_type { return shift->{original_hold}->hold_type; }
sub original_target { return shift->{original_hold}->target; }
sub patron_id {
    my $usr = shift->{original_hold}->usr;
    return ref($usr) ? $usr->id : $usr;
}
sub selection_depth { return shift->{original_hold}->selection_depth || 0; }

=head2 with_target_as_params()
If you'd like to pass a context object to
open-ils.circ.title_hold.is_possible or similar, this is
the method for you!  Usage:

$ctx->with_target_as_params(123); # returns a hashref

=cut
sub with_target_as_params {
    my ($self, $target) = @_;
    my $params = {
        depth => $self->selection_depth,
        hold_type => $self->desired_type,
        patronid => $self->patron_id,
        pickup_lib => $self->{original_hold}->pickup_lib,
        selection_ou => $self->{original_hold}->selection_ou,

        # The hash uses a different key for the target field
        # (e.g. titleid, copy_id) depending on the hold type
        $HC->target_field_name($self->desired_type) => $target,
    };
    return $params;
}

=head2 with_target_as_ahr()
Create a new ahr (hold request) fieldmapper object with the new target.
=cut
sub with_target_as_ahr {
    my ($self, $target, $additional_fields) = @_;
    $additional_fields ||= {};

    my $ahr = $self->{original_hold}->clone;
    $ahr->clear_id;
    $ahr->clear_holdable_formats unless ($self->desired_type eq OILS_HOLD_TYPE_METARECORD);
    $ahr->hold_type($self->desired_type);
    $ahr->target($target);
    foreach my $field (keys %{ $additional_fields }) {
        $ahr->$field($additional_fields->{$field});
    }
    return $ahr;
}

=head2 potential_targets()

Use the provided CStore Editor and function ref to get an
arrayref of hashrefs that represent potential targets that
the user could change the hold target to.

$ctx->possible_targets($editor);
=cut
sub possible_targets {
    my ($self, $editor, $target_query_builder, $extra_where_clauses) = @_;
    $extra_where_clauses ||= {};
    my $query = $target_query_builder->($self);
    my $where_clause = $query->{where} || {};
    $query->{where} = _deep_append_hash($where_clause, $extra_where_clauses);
    return $editor->json_query($query);
}


sub _deep_append_hash {
    my ($existing, $new) = @_;

    my %new_hash = %{$existing};
    foreach my $key ( keys %{$new} ) {
        if( exists $new_hash{$key} ) {
            if ((ref $new_hash{$key} eq 'HASH') && (ref $new->{$key} eq 'HASH')) {
                $new_hash{$key} = _deep_append_hash($new_hash{$key}, $new->{$key});
            }
        } else {
            $new_hash{$key} = $new->{$key};
        }
    }
    return \%new_hash;
}


1;
