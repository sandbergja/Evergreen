package OpenILS::Application::Dashboard;

use strict;
use warnings;

use OpenSRF::AppSession;
use OpenILS::Application;
use base qw/OpenILS::Application/;

use OpenILS::Utils::DateTime qw/:datetime/;
use OpenILS::Utils::CStoreEditor qw/:funcs/;
use OpenILS::Utils::Fieldmapper;
use OpenILS::Application::AppUtils;
my $U = "OpenILS::Application::AppUtils";

use DateTime;
use DateTime::Format::ISO8601;
use OpenSRF::Utils::Logger qw/$logger/;
use Data::Dumper;

my $date_parser = DateTime::Format::ISO8601->new;

=head1 NAME

OpenILS::Application::Dashboard - Dashboard API for circulation and library statistics

=head1 SYNOPSIS

This module provides OpenSRF methods for retrieving dashboard data including:
- Circulation statistics by various dimensions
- Holds statistics
- Patron activity metrics
- Collection analytics

=head1 DESCRIPTION

The Dashboard API provides efficient, aggregated data queries for library
dashboards and reporting widgets. All methods require authentication and
respect organizational unit permissions.

=head1 METHODS

=cut

# -------------------------------------------------------------------------
# Circulation Summary
# -------------------------------------------------------------------------

=head2 circulation_summary

Returns a summary of circulation statistics for a given time period.

Parameters:
- authtoken: Authentication token
- query: Hash reference containing:
  - start_date: ISO8601 date string
  - end_date: ISO8601 date string
  - org_unit: Optional org unit ID (defaults to workstation org unit)
  - include_descendants: Optional boolean to include child org units

Returns:
- Hash reference with circulation summary data

=cut

__PACKAGE__->register_method(
    method   => "circulation_summary",
    api_name => "open-ils.dashboard.circulation.summary",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'object', desc => 'Query parameters (start_date, end_date, org_unit, include_descendants)'},
        ],
        return => { desc => 'Circulation summary including total checkouts, renewals, and holds filled'}
    }
);

sub circulation_summary {
    my ($self, $conn, $authtoken, $query) = @_;

    $logger->info("Dashboard.pm: circulation_summary CALLED");
    $logger->info("Query params: " . Dumper($query));

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    $logger->info("Dashboard.pm: Auth successful");

    # Get org unit (default to user's workstation org unit)
    my $org_unit = $query->{org_unit} || $e->requestor->ws_ou;

    # Check permissions
    return $e->die_event unless $e->allowed("VIEW_CIRCULATIONS", $org_unit);

    # Parse dates
    my $start_date = $query->{start_date};
    my $end_date = $query->{end_date};

    unless ($start_date && $end_date) {
        return new OpenILS::Event("BAD_PARAMS", desc => "start_date and end_date are required");
    }

    # Get org unit tree if include_descendants is true
    my $org_list = $query->{include_descendants} ?
        $U->get_org_descendants($org_unit) :
        [$org_unit];

    # Query circulation data
    my $checkouts = $e->json_query({
        select => {
            circ => [
                {transform => 'count', column => 'id', alias => 'count'}
            ]
        },
        from => 'circ',
        where => {
            circ_lib => $org_list,
            xact_start => {
                between => [$start_date, $end_date]
            }
        }
    });

    my $renewals = $e->json_query({
        select => {
            circ => [
                {transform => 'count', column => 'id', alias => 'count'}
            ]
        },
        from => 'circ',
        where => {
            circ_lib => $org_list,
            xact_start => {
                between => [$start_date, $end_date]
            },
            '-or' => [
                {desk_renewal => 't'},
                {opac_renewal => 't'},
                {phone_renewal => 't'}
            ]
        }
    });

    my $holds_filled = $e->json_query({
        select => {
            ahr => [
                {transform => 'count', column => 'id', alias => 'count'}
            ]
        },
        from => 'ahr',
        where => {
            pickup_lib => $org_list,
            fulfillment_time => {
                between => [$start_date, $end_date]
            }
        }
    });

    $e->disconnect;

    return {
        total_checkouts => $checkouts->[0]->{count} || 0,
        total_renewals => $renewals->[0]->{count} || 0,
        total_holds_filled => $holds_filled->[0]->{count} || 0,
        period_start => $start_date,
        period_end => $end_date,
        org_unit => $org_unit
    };
}

# -------------------------------------------------------------------------
# Circulation by Shelving Location
# -------------------------------------------------------------------------

=head2 circulation_by_shelving_location

Returns circulation statistics grouped by shelving location.

Parameters:
- authtoken: Authentication token
- query: Hash reference containing date range and org unit filters

Returns:
- Array of hashes with circulation data by shelving location

=cut

__PACKAGE__->register_method(
    method   => "circulation_by_shelving_location",
    api_name => "open-ils.dashboard.circulation.by_shelving_location",
    stream   => 1,
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'object', desc => 'Query parameters'},
        ],
        return => { desc => 'Stream of circulation data grouped by shelving location'}
    }
);

sub circulation_by_shelving_location {
    my ($self, $conn, $authtoken, $query) = @_;

    $logger->info("Dashboard.pm: circulation_by_shelving_location CALLED");
    $logger->info("Query params: " . Dumper($query));

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    $logger->info("Dashboard.pm: Auth successful");

    # Get org unit
    my $org_unit = $query->{org_unit} || $e->requestor->ws_ou;

    # Check permissions
    return $e->die_event unless $e->allowed("VIEW_CIRCULATIONS", $org_unit);

    # Parse dates
    my $start_date = $query->{start_date};
    my $end_date = $query->{end_date};

    unless ($start_date && $end_date) {
        return new OpenILS::Event("BAD_PARAMS", desc => "start_date and end_date are required");
    }

    # Get org unit tree if include_descendants is true
    my $org_list = $query->{include_descendants} ?
        $U->get_org_descendants($org_unit) :
        [$org_unit];

    # Query circulation by shelving location
    # This joins circulation data with copy location information
    my $results = $e->json_query({
        select => {
            acpl => ['id', 'name'],
            circ => [
                {transform => 'count', column => 'id', alias => 'checkouts'},
            ]
        },
        from => {
            circ => {
                acp => {
                    field => 'id',
                    fkey => 'target_copy'
                },
                acpl => {
                    field => 'id',
                    fkey => 'location',
                    join => {
                        acp => {}
                    }
                }
            }
        },
        where => {
            '+circ' => {
                circ_lib => $org_list,
                xact_start => {
                    between => [$start_date, $end_date]
                }
            }
        },
        order_by => [
            {class => 'circ', field => 'checkouts', direction => 'desc'}
        ]
    });

    # Calculate renewals separately
    my $renewals = $e->json_query({
        select => {
            acpl => ['id'],
            circ => [
                {transform => 'count', column => 'id', alias => 'renewals'},
            ]
        },
        from => {
            circ => {
                acp => {
                    field => 'id',
                    fkey => 'target_copy'
                },
                acpl => {
                    field => 'id',
                    fkey => 'location',
                    join => {
                        acp => {}
                    }
                }
            }
        },
        where => {
            '+circ' => {
                circ_lib => $org_list,
                xact_start => {
                    between => [$start_date, $end_date]
                },
                '-or' => [
                    {desk_renewal => 't'},
                    {opac_renewal => 't'},
                    {phone_renewal => 't'}
                ]
            }
        }
    });

    # Create a lookup hash for renewals
    my %renewal_lookup;
    foreach my $r (@$renewals) {
        $renewal_lookup{$r->{id}} = $r->{renewals};
    }

    # Stream results
    foreach my $row (@$results) {
        my $location_id = $row->{id};
        my $checkouts = $row->{checkouts} || 0;
        my $renewals = $renewal_lookup{$location_id} || 0;

        $conn->respond({
            shelving_location => $location_id,
            shelving_location_name => $row->{name},
            checkouts => $checkouts,
            renewals => $renewals,
            total => $checkouts + $renewals
        });
    }

    $e->disconnect;
    return undef;
}

# -------------------------------------------------------------------------
# Circulation Trend
# -------------------------------------------------------------------------

=head2 circulation_trend

Returns circulation trend data over time (daily aggregates).

Parameters:
- authtoken: Authentication token
- query: Hash reference with date range and org unit

Returns:
- Stream of daily circulation counts

=cut

__PACKAGE__->register_method(
    method   => "circulation_trend",
    api_name => "open-ils.dashboard.circulation.trend",
    stream   => 1,
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'object', desc => 'Query parameters'},
        ],
        return => { desc => 'Stream of daily circulation trend data'}
    }
);

sub circulation_trend {
    my ($self, $conn, $authtoken, $query) = @_;

    $logger->info("Dashboard.pm: circulation_trend CALLED");
    $logger->info("Query params: " . Dumper($query));

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    $logger->info("Dashboard.pm: Auth successful");

    # Get org unit
    my $org_unit = $query->{org_unit} || $e->requestor->ws_ou;

    # Check permissions
    return $e->die_event unless $e->allowed("VIEW_CIRCULATIONS", $org_unit);

    # Parse dates
    my $start_date = $query->{start_date};
    my $end_date = $query->{end_date};

    unless ($start_date && $end_date) {
        return new OpenILS::Event("BAD_PARAMS", desc => "start_date and end_date are required");
    }

    # Get org unit tree
    my $org_list = $query->{include_descendants} ?
        $U->get_org_descendants($org_unit) :
        [$org_unit];

    # Query daily circulation counts
    my $results = $e->json_query({
        select => {
            circ => [
                {
                    transform => 'date',
                    column => 'xact_start',
                    alias => 'date'
                },
                {
                    transform => 'count',
                    column => 'id',
                    alias => 'total'
                }
            ]
        },
        from => 'circ',
        where => {
            circ_lib => $org_list,
            xact_start => {
                between => [$start_date, $end_date]
            }
        },
        order_by => [
            {class => 'circ', field => 'date'}
        ]
    });

    # Stream results
    foreach my $row (@$results) {
        $conn->respond({
            date => $row->{date},
            checkouts => $row->{total} || 0,
            total => $row->{total} || 0
        });
    }

    $e->disconnect;
    return undef;
}

# -------------------------------------------------------------------------
# Current Holds Count
# -------------------------------------------------------------------------

=head2 holds_current_count

Returns the current count of holds in various states.

Parameters:
- authtoken: Authentication token
- org_unit: Optional org unit ID

Returns:
- Hash with holds counts by status

=cut

__PACKAGE__->register_method(
    method   => "holds_current_count",
    api_name => "open-ils.dashboard.holds.current_count",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'number', desc => 'Optional org unit ID'},
        ],
        return => { desc => 'Current holds counts by status'}
    }
);

sub holds_current_count {
    my ($self, $conn, $authtoken, $org_unit) = @_;

    $logger->info("Dashboard.pm: holds_current_count CALLED");
    $logger->info("Org unit: $org_unit");

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    $logger->info("Dashboard.pm: Auth successful");

    # Get org unit
    $org_unit ||= $e->requestor->ws_ou;

    # Check permissions
    return $e->die_event unless $e->allowed("VIEW_HOLD", $org_unit);

    # Query active holds (not cancelled, not fulfilled)
    my $active_holds = $e->json_query({
        select => {
            ahr => [
                {transform => 'count', column => 'id', alias => 'count'}
            ]
        },
        from => 'ahr',
        where => {
            pickup_lib => $org_unit,
            cancel_time => undef,
            fulfillment_time => undef
        }
    });

    # Query holds on shelf (waiting for pickup)
    my $shelf_holds = $e->json_query({
        select => {
            ahr => [
                {transform => 'count', column => 'id', alias => 'count'}
            ]
        },
        from => 'ahr',
        where => {
            pickup_lib => $org_unit,
            shelf_time => {'!=' => undef},
            cancel_time => undef,
            fulfillment_time => undef
        }
    });

    # Query in-transit holds
    my $transit_holds = $e->json_query({
        select => {
            ahr => [
                {transform => 'count', column => 'id', alias => 'count'}
            ]
        },
        from => {
            ahr => {
                ahtc => {
                    field => 'hold',
                    fkey => 'id'
                }
            }
        },
        where => {
            '+ahr' => {
                pickup_lib => $org_unit,
                cancel_time => undef,
                fulfillment_time => undef
            },
            '+ahtc' => {
                dest_recv_time => undef
            }
        }
    });

    $e->disconnect;

    return {
        active => $active_holds->[0]->{count} || 0,
        on_shelf => $shelf_holds->[0]->{count} || 0,
        in_transit => $transit_holds->[0]->{count} || 0,
        org_unit => $org_unit
    };
}

1;
