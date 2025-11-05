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

    # Fetch all circulations in date range with copy location (simple query without GROUP BY)
    my $circs = $e->json_query({
        select => {
            acp => ['location'],
            circ => ['id', 'desk_renewal', 'opac_renewal', 'phone_renewal']
        },
        from => {
            circ => {
                acp => {
                    field => 'id',
                    fkey => 'target_copy'
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
        }
    });

    $logger->info("Dashboard.pm: circulation_by_shelving_location - Raw circs count = " . ($circs ? scalar(@$circs) : "undef"));

    # Group by location in Perl, counting checkouts vs renewals
    my %by_location;
    if ($circs && @$circs) {
        foreach my $circ (@$circs) {
            my $location_id = $circ->{location};
            next unless $location_id;

            $by_location{$location_id} ||= {checkouts => 0, renewals => 0};

            # Check if this is a renewal
            if ($circ->{desk_renewal} eq 't' || $circ->{opac_renewal} eq 't' || $circ->{phone_renewal} eq 't') {
                $by_location{$location_id}->{renewals}++;
            } else {
                $by_location{$location_id}->{checkouts}++;
            }
        }
    }

    # Fetch location names
    my %location_names;
    if (%by_location) {
        my @location_ids = keys %by_location;
        my $locations = $e->search_asset_copy_location({id => \@location_ids});
        foreach my $loc (@$locations) {
            $location_names{$loc->id} = $loc->name;
        }
    }

    $logger->info("Dashboard.pm: circulation_by_shelving_location - Grouped locations count = " . scalar(keys %by_location));

    # Stream results
    foreach my $location_id (sort keys %by_location) {
        my $checkouts = $by_location{$location_id}->{checkouts} || 0;
        my $renewals = $by_location{$location_id}->{renewals} || 0;

        $conn->respond({
            shelving_location => $location_id,
            shelving_location_name => $location_names{$location_id} || "Unknown",
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

    $logger->info("Dashboard.pm: org_list = " . Dumper($org_list));
    $logger->info("Dashboard.pm: start_date = $start_date, end_date = $end_date");

    # Fetch all circulations in date range (simple query without GROUP BY)
    my $circs = $e->json_query({
        select => {
            circ => ['xact_start']
        },
        from => 'circ',
        where => {
            circ_lib => $org_list,
            xact_start => {
                between => [$start_date, $end_date]
            }
        }
    });

    $logger->info("Dashboard.pm: Raw circs count = " . ($circs ? scalar(@$circs) : "undef"));

    # Group by date in Perl (since json_query GROUP BY is broken)
    my %by_date;
    if ($circs && @$circs) {
        foreach my $circ (@$circs) {
            my $date_str = substr($circ->{xact_start}, 0, 10);  # Extract YYYY-MM-DD
            $by_date{$date_str}++;
        }
    }

    # Convert hash to sorted array
    my @results = map {
        { date => $_, total => $by_date{$_} }
    } sort keys %by_date;

    my $results = \@results;

    $logger->info("Dashboard.pm: results count = " . scalar(@results));
    $logger->info("Dashboard.pm: results data = " . Dumper($results));

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
            {type => 'object', desc => 'Query parameters (org_unit, include_descendants)'},
        ],
        return => { desc => 'Current holds counts by status'}
    }
);

sub holds_current_count {
    my ($self, $conn, $authtoken, $query) = @_;

    $logger->info("Dashboard.pm: holds_current_count CALLED");
    $logger->info("Query params: " . Dumper($query));

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    $logger->info("Dashboard.pm: Auth successful");

    # Get org unit (support both old single param and new query hash)
    my $org_unit;
    if (ref($query) eq 'HASH') {
        $org_unit = $query->{org_unit} || $e->requestor->ws_ou;
    } else {
        # Backward compatibility: if query is just a number, treat as org_unit
        $org_unit = $query || $e->requestor->ws_ou;
    }

    # Check permissions
    return $e->die_event unless $e->allowed("VIEW_HOLD", $org_unit);

    # Get org unit tree if include_descendants is true
    my $org_list;
    if (ref($query) eq 'HASH' && $query->{include_descendants}) {
        $org_list = $U->get_org_descendants($org_unit);
        $logger->info("Dashboard.pm: Using org descendants: " . join(', ', @$org_list));
    } else {
        $org_list = [$org_unit];
        $logger->info("Dashboard.pm: Using single org: $org_unit");
    }

    # Query active holds (not cancelled, not fulfilled)
    my $active_holds = $e->json_query({
        select => {
            ahr => [
                {transform => 'count', column => 'id', alias => 'count'}
            ]
        },
        from => 'ahr',
        where => {
            pickup_lib => $org_list,
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
            pickup_lib => $org_list,
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
                pickup_lib => $org_list,
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

# -------------------------------------------------------------------------
# Widget Configuration Management
# -------------------------------------------------------------------------

=head2 widgets_list

Returns a list of available dashboard widget configurations.

Parameters:
- authtoken: Authentication token
- query: Hash reference containing optional filters (category, enabled)

Returns:
- Stream of widget configuration objects

=cut

__PACKAGE__->register_method(
    method   => "widgets_list",
    api_name => "open-ils.dashboard.widgets.list",
    stream   => 1,
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'object', desc => 'Query parameters (category, enabled)'},
        ],
        return => { desc => 'Stream of widget configuration objects'}
    }
);

sub widgets_list {
    my ($self, $conn, $authtoken, $query) = @_;

    $logger->info("Dashboard.pm: widgets_list CALLED");
    $logger->info("Query params: " . Dumper($query));

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    # Build search criteria
    my $search = {
        enabled => 't'  # Only return enabled widgets by default
    };

    # Add category filter if specified
    if ($query->{category}) {
        $search->{category} = $query->{category};
    }

    # Override enabled filter if explicitly set
    if (defined $query->{enabled}) {
        $search->{enabled} = $query->{enabled} ? 't' : 'f';
    }

    # Query widgets from database
    my $widgets = $e->search_dashboard_widgets($search, {
        order_by => {dwdgt => 'name'}
    });

    # Stream results
    foreach my $widget (@$widgets) {
        $conn->respond({
            code => $widget->code,
            name => $widget->name,
            category => $widget->category,
            description => $widget->description,
            json_config => OpenSRF::Utils::JSON->JSON2perl($widget->json_config),
            view_permission => $widget->view_permission
        });
    }

    $e->disconnect;
    return undef;
}

=head2 widgets_get

Returns a specific widget configuration by code.

Parameters:
- authtoken: Authentication token
- widget_code: Widget code identifier

Returns:
- Widget configuration object

=cut

__PACKAGE__->register_method(
    method   => "widgets_get",
    api_name => "open-ils.dashboard.widgets.get",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'string', desc => 'Widget code'},
        ],
        return => { desc => 'Widget configuration object'}
    }
);

sub widgets_get {
    my ($self, $conn, $authtoken, $widget_code) = @_;

    $logger->info("Dashboard.pm: widgets_get CALLED for widget: $widget_code");

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    # Retrieve widget from database
    my $widget = $e->retrieve_dashboard_widgets($widget_code);

    unless ($widget) {
        $logger->warn("Dashboard.pm: Widget not found: $widget_code");
        return new OpenILS::Event("NOT_FOUND", desc => "Widget '$widget_code' not found");
    }

    $e->disconnect;

    return {
        code => $widget->code,
        name => $widget->name,
        category => $widget->category,
        description => $widget->description,
        json_config => OpenSRF::Utils::JSON->JSON2perl($widget->json_config),
        view_permission => $widget->view_permission,
        enabled => $widget->enabled
    };
}

=head2 user_widgets_get

Returns the list of widgets enabled for a specific user's dashboard.
This combines org-level defaults with user-specific customizations.

Parameters:
- authtoken: Authentication token

Returns:
- Array of widget configurations

=cut

__PACKAGE__->register_method(
    method   => "user_widgets_get",
    api_name => "open-ils.dashboard.user.widgets.get",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
        ],
        return => { desc => 'Array of user widget configurations'}
    }
);

sub user_widgets_get {
    my ($self, $conn, $authtoken) = @_;

    $logger->info("Dashboard.pm: user_widgets_get CALLED");

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    my $user_id = $e->requestor->id;
    my $org_unit = $e->requestor->ws_ou;

    $logger->info("Dashboard.pm: Getting widgets for user $user_id at org $org_unit");

    # Check if user has customized their dashboard
    my $user_widgets = $e->search_dashboard_user_widgets({
        usr => $user_id
    }, {
        order_by => {duwdgt => 'display_order'}
    });

    my @widget_codes;

    if (@$user_widgets) {
        # User has customizations - use those
        $logger->info("Dashboard.pm: User has " . scalar(@$user_widgets) . " customized widgets");
        @widget_codes = map { $_->widget_code } @$user_widgets;
    } else {
        # No user customizations - use org defaults
        $logger->info("Dashboard.pm: Using org defaults for user");

        # Get org setting for default widgets
        my $org_defaults = $U->ou_ancestor_setting_value($org_unit, 'ui.dashboard.default_widgets', $e);

        if ($org_defaults && ref($org_defaults) eq 'ARRAY') {
            @widget_codes = @$org_defaults;
            $logger->info("Dashboard.pm: Found org defaults: " . join(', ', @widget_codes));
        } else {
            # No org defaults either - return empty
            $logger->warn("Dashboard.pm: No org defaults found");
            @widget_codes = ();
        }
    }

    # Fetch full widget configurations for the selected widgets
    my @results;
    foreach my $code (@widget_codes) {
        my $widget = $e->retrieve_dashboard_widgets($code);
        if ($widget && $widget->enabled eq 't') {
            push @results, {
                code => $widget->code,
                name => $widget->name,
                category => $widget->category,
                json_config => OpenSRF::Utils::JSON->JSON2perl($widget->json_config)
            };
        } else {
            $logger->warn("Dashboard.pm: Widget '$code' not found or disabled");
        }
    }

    $e->disconnect;
    return \@results;
}

=head2 user_widgets_update

Updates a user's dashboard widget preferences.

Parameters:
- authtoken: Authentication token
- widget_codes: Array of widget codes in display order

Returns:
- Success/failure status

=cut

__PACKAGE__->register_method(
    method   => "user_widgets_update",
    api_name => "open-ils.dashboard.user.widgets.update",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'array', desc => 'Array of widget codes in display order'},
        ],
        return => { desc => 'Success status'}
    }
);

sub user_widgets_update {
    my ($self, $conn, $authtoken, $widget_codes) = @_;

    $logger->info("Dashboard.pm: user_widgets_update CALLED");
    $logger->info("Widget codes: " . Dumper($widget_codes));

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken, xact => 1);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    my $user_id = $e->requestor->id;

    # Delete existing user widget preferences
    my $existing = $e->search_dashboard_user_widgets({usr => $user_id});
    foreach my $widget (@$existing) {
        $e->delete_dashboard_user_widgets($widget) or return $e->die_event;
    }

    # Insert new preferences
    my $display_order = 0;
    foreach my $code (@$widget_codes) {
        # Verify widget exists
        my $widget = $e->retrieve_dashboard_widgets($code);
        unless ($widget) {
            $logger->error("Dashboard.pm: Widget '$code' not found");
            $e->rollback;
            return new OpenILS::Event("NOT_FOUND", desc => "Widget '$code' not found");
        }

        # Create user widget entry
        my $user_widget = Fieldmapper::dashboard::user_widgets->new;
        $user_widget->usr($user_id);
        $user_widget->widget_code($code);
        $user_widget->display_order($display_order++);
        $user_widget->created('now');
        $user_widget->modified('now');

        $e->create_dashboard_user_widgets($user_widget) or return $e->die_event;
    }

    $e->commit;
    $logger->info("Dashboard.pm: Successfully updated user widgets");

    return {success => 1, count => scalar(@$widget_codes)};
}

1;
