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
use OpenSRF::Utils::JSON;
use Data::Dumper;

my $date_parser = DateTime::Format::ISO8601->new;

# =========================================================================
# UNIFIED WIDGET DATA METHOD
# =========================================================================
# This is the ONLY method for fetching dashboard widget data.
# All widgets query materialized tables through this method.
# Widget configs contain complete query specifications - no code changes needed!
# =========================================================================

__PACKAGE__->register_method(
    method   => "get_widget_data",
    api_name => "open-ils.dashboard.widget.data",
    stream   => 1,
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'object', desc => 'Query specification (table, dimensions, metrics, filters, lookups, etc.)'},
            {type => 'object', desc => 'Query parameters (org_unit, timeRange, year, start_month, end_month, etc.)'},
        ],
        return => { desc => 'Stream of widget data based on widget query specification'}
    }
);

sub get_widget_data {
    my ($self, $conn, $authtoken, $query_spec, $params) = @_;

    $logger->info("Dashboard.pm: get_widget_data CALLED");
    $logger->info("Query spec: " . Dumper($query_spec));
    $logger->info("Params: " . Dumper($params));

    # 1. Authenticate
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    # 2. Validate query spec
    unless ($query_spec && $query_spec->{table}) {
        $logger->error("Dashboard.pm: Invalid query specification");
        return new OpenILS::Event("BAD_PARAMS", desc => "Query specification must include 'table' field");
    }

    # 3. Check permissions
    my $org_unit = $params->{org_unit} || $e->requestor->ws_ou;
    return $e->die_event unless $e->allowed("VIEW_CIRCULATIONS", $org_unit);

    # 4. Substitute variables in filters
    my $filters = substitute_variables($query_spec->{filters}, $e, $params);

    $logger->info("Dashboard.pm: Filters after substitution: " . Dumper($filters));

    # 5. Get table alias
    my $table_alias = get_table_alias($query_spec->{table});

    # 6. Query the materialized table specified in query spec
    my @select_fields = (@{$query_spec->{dimensions} || []}, @{$query_spec->{metrics} || []});

    $logger->info("Dashboard.pm: Querying table $table_alias with fields: " . join(', ', @select_fields));

    my $raw_results = $e->json_query({
        select => {
            $table_alias => \@select_fields
        },
        from => $table_alias,
        where => $filters
    });

    $logger->info("Dashboard.pm: Raw results count: " . ($raw_results ? scalar(@$raw_results) : 0));

    # 7. Aggregate by dimensions in Perl (json_query GROUP BY is broken!)
    my $aggregated = aggregate_by_dimensions(
        $raw_results,
        $query_spec->{dimensions},
        $query_spec->{metrics},
        $query_spec->{aggregation}
    );

    $logger->info("Dashboard.pm: Aggregated results count: " . scalar(@$aggregated));

    # 8. Combine date dimensions if needed (year, month, day → date)
    my $with_dates = combine_date_dimensions($aggregated, $query_spec->{dimensions});

    # 9. Perform name lookups
    my $with_names = perform_lookups($with_dates, $query_spec->{lookups}, $e);

    # 10. Sort results
    my $sorted = sort_results($with_names, $query_spec->{sort});

    # 11. Limit results
    my $limited = limit_results($sorted, $query_spec->{limit});

    $logger->info("Dashboard.pm: Final results count: " . scalar(@$limited));

    # 12. Stream results
    foreach my $row (@$limited) {
        $conn->respond($row);
    }

    $e->disconnect;
    return undef;
}

# =========================================================================
# HELPER FUNCTIONS
# =========================================================================

# Helper: Get table alias for json_query
sub get_table_alias {
    my $table_name = shift;

    my %aliases = (
        'dashboard.materialized_action_all_circulation' => 'dmaac',
        'dashboard.materialized_action_hold_request' => 'dmahr',
        'dashboard.materialized_items' => 'dmi'
    );

    return $aliases{$table_name} || 'dmaac';
}

# Helper: Substitute variables in filters
sub substitute_variables {
    my ($filters, $e, $params) = @_;

    return {} unless $filters;

    # Get org unit and descendants
    my $org_unit = $params->{org_unit} || $e->requestor->ws_ou;
    my $org_descendants = $params->{include_descendants} ?
        $U->get_org_descendants($org_unit) : [$org_unit];

    # Calculate date/time values
    my ($sec, $min, $hour, $mday, $mon, $year_offset, $wday, $yday, $isdst) = localtime();
    my $current_year = $year_offset + 1900;
    my $current_month = $mon + 1;

    # Parse timeRange if provided
    my ($start_month, $end_month) = (1, 12);
    if ($params->{timeRange}) {
        if ($params->{timeRange} eq 'month') {
            $start_month = $end_month = $current_month;
        } elsif ($params->{timeRange} eq 'quarter') {
            my $quarter = int(($current_month - 1) / 3);
            $start_month = $quarter * 3 + 1;
            $end_month = $start_month + 2;
        } elsif ($params->{timeRange} eq 'year') {
            $start_month = 1;
            $end_month = 12;
        }
    }

    # Use params if explicitly provided
    $start_month = $params->{start_month} if defined $params->{start_month};
    $end_month = $params->{end_month} if defined $params->{end_month};
    my $target_year = $params->{year} || $current_year;

    # Build substitution map
    my %vars = (
        '$org_descendants' => $org_descendants,
        '$org_unit' => $org_unit,
        '$current_year' => $current_year,
        '$current_month' => $current_month,
        '$year' => $target_year,
        '$month_range' => {between => [$start_month, $end_month]},
        '$start_month' => $start_month,
        '$end_month' => $end_month
    );

    # Replace variables in filters
    my $result = {};
    foreach my $key (keys %$filters) {
        my $value = $filters->{$key};

        if (!ref($value) && $value =~ /^\$/) {
            # Variable substitution
            $result->{$key} = $vars{$value};
        } else {
            # Static value
            $result->{$key} = $value;
        }
    }

    return $result;
}

# Helper: Aggregate by dimensions in Perl
sub aggregate_by_dimensions {
    my ($raw_results, $dimensions, $metrics, $aggregation) = @_;

    return [] unless $raw_results && @$raw_results;
    return [] unless $dimensions && @$dimensions;
    return [] unless $metrics && @$metrics;

    my %aggregated;

    foreach my $row (@$raw_results) {
        # Build key from dimension values
        my $key = join('|', map { $row->{$_} || '' } @$dimensions);

        # Initialize if first time seeing this key
        unless ($aggregated{$key}) {
            $aggregated{$key} = {};
            # Copy dimension values
            foreach my $dim (@$dimensions) {
                $aggregated{$key}->{$dim} = $row->{$dim};
            }
            # Initialize metrics
            foreach my $metric (@$metrics) {
                $aggregated{$key}->{$metric} = 0;
            }
        }

        # Aggregate metrics
        foreach my $metric (@$metrics) {
            my $value = $row->{$metric} || 0;

            if ($aggregation eq 'sum') {
                $aggregated{$key}->{$metric} += $value;
            } elsif ($aggregation eq 'count') {
                $aggregated{$key}->{$metric}++;
            } elsif ($aggregation eq 'avg') {
                # For average, we'll track sum and count
                $aggregated{$key}->{"${metric}_sum"} += $value;
                $aggregated{$key}->{"${metric}_count"}++;
            } elsif ($aggregation eq 'max') {
                my $current = $aggregated{$key}->{$metric};
                $aggregated{$key}->{$metric} = $value if $value > $current;
            } elsif ($aggregation eq 'min') {
                my $current = $aggregated{$key}->{$metric};
                $aggregated{$key}->{$metric} = $value if !$current || $value < $current;
            }
        }
    }

    # Calculate averages if needed
    if ($aggregation eq 'avg') {
        foreach my $key (keys %aggregated) {
            foreach my $metric (@$metrics) {
                my $sum = $aggregated{$key}->{"${metric}_sum"} || 0;
                my $count = $aggregated{$key}->{"${metric}_count"} || 1;
                $aggregated{$key}->{$metric} = $sum / $count;
                # Clean up temporary fields
                delete $aggregated{$key}->{"${metric}_sum"};
                delete $aggregated{$key}->{"${metric}_count"};
            }
        }
    }

    # Convert hash to array
    my @results = values %aggregated;

    return \@results;
}

# Helper: Combine date dimensions into single date field
sub combine_date_dimensions {
    my ($data, $dimensions) = @_;

    return $data unless $data && @$data;
    return $data unless $dimensions && @$dimensions;

    # Check if this has date dimensions (year, month, day)
    my $has_year = grep { $_ eq 'year' } @$dimensions;
    my $has_month = grep { $_ eq 'month' } @$dimensions;
    my $has_day = grep { $_ eq 'day' } @$dimensions;

    if ($has_year && $has_month && $has_day) {
        # Combine into date field (YYYY-MM-DD format)
        foreach my $row (@$data) {
            my $year = $row->{year};
            my $month = sprintf("%02d", $row->{month});
            my $day = sprintf("%02d", $row->{day});
            $row->{date} = "$year-$month-$day";
        }
    } elsif ($has_year && $has_month) {
        # Combine into date field (YYYY-MM format)
        foreach my $row (@$data) {
            my $year = $row->{year};
            my $month = sprintf("%02d", $row->{month});
            $row->{date} = "$year-$month";
        }
    }

    return $data;
}

# Helper: Perform name lookups
sub perform_lookups {
    my ($data, $lookups, $e) = @_;

    return $data unless $lookups && %$lookups;
    return $data unless $data && @$data;

    foreach my $dimension (keys %$lookups) {
        my $lookup_spec = $lookups->{$dimension};
        my $table = $lookup_spec->{table};
        my $key_field = $lookup_spec->{keyField} || 'id';
        my $name_field = $lookup_spec->{nameField} || 'name';
        my $output_field = $lookup_spec->{outputField} || "${dimension}_name";

        # Collect unique IDs
        my %ids;
        foreach my $row (@$data) {
            my $id = $row->{$dimension};
            $ids{$id} = 1 if defined $id;
        }

        next unless %ids;

        # Fetch names based on table
        my %names;
        my @ids = keys %ids;

        if ($table eq 'permission.grp_tree') {
            my $records = $e->search_permission_grp_tree({id => \@ids});
            foreach my $rec (@$records) {
                $names{$rec->id()} = $rec->name();  # Call as functions!
            }
        } elsif ($table eq 'actor.org_unit') {
            my $records = $e->search_actor_org_unit({id => \@ids});
            foreach my $rec (@$records) {
                $names{$rec->id()} = $rec->name();  # Call as functions!
            }
        } elsif ($table eq 'asset.copy_location') {
            my $records = $e->search_asset_copy_location({id => \@ids});
            foreach my $rec (@$records) {
                $names{$rec->id()} = $rec->name();  # Call as functions!
            }
        } elsif ($table eq 'config.copy_status') {
            my $records = $e->search_config_copy_status({id => \@ids});
            foreach my $rec (@$records) {
                $names{$rec->id()} = $rec->name();  # Call as functions!
            }
        }
        # Add more table lookups as needed

        # Add names to results
        foreach my $row (@$data) {
            my $id = $row->{$dimension};
            $row->{$output_field} = $names{$id} || 'Unknown' if defined $id;
        }
    }

    return $data;
}

# Helper: Sort results
sub sort_results {
    my ($data, $sort_spec) = @_;

    return $data unless $sort_spec && $sort_spec->{field};
    return $data unless $data && @$data;

    my $field = $sort_spec->{field};
    my $order = $sort_spec->{order} || 'asc';

    my @sorted;
    if ($order eq 'desc') {
        @sorted = sort { ($b->{$field} || 0) <=> ($a->{$field} || 0) } @$data;
    } else {
        @sorted = sort { ($a->{$field} || 0) <=> ($b->{$field} || 0) } @$data;
    }

    return \@sorted;
}

# Helper: Limit results
sub limit_results {
    my ($data, $limit) = @_;

    return $data unless $limit && $limit > 0;
    return $data unless $data && @$data;

    my $count = scalar(@$data);
    return $data if $count <= $limit;

    my @limited = @$data[0 .. $limit - 1];
    return \@limited;
}

# =========================================================================
# WIDGET MANAGEMENT METHODS
# =========================================================================

__PACKAGE__->register_method(
    method   => "widget_list",
    api_name => "open-ils.dashboard.widget.list",
    stream   => 1,
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'object', desc => 'Query parameters (category, enabled)'},
        ],
        return => { desc => 'Stream of widget configuration objects'}
    }
);

sub widget_list {
    my ($self, $conn, $authtoken, $query) = @_;

    $logger->info("Dashboard.pm: widget_list CALLED");
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
    my $widgets = $e->search_dashboard_widget($search, {
        order_by => {dw => 'name'}
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

__PACKAGE__->register_method(
    method   => "widget_get",
    api_name => "open-ils.dashboard.widget.get",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'string', desc => 'Widget code'},
        ],
        return => { desc => 'Widget configuration object'}
    }
);

sub widget_get {
    my ($self, $conn, $authtoken, $widget_code) = @_;

    $logger->info("Dashboard.pm: widget_get CALLED for widget: $widget_code");

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    # Retrieve widget from database
    my $widget = $e->retrieve_dashboard_widget($widget_code);

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

__PACKAGE__->register_method(
    method   => "user_widget_get",
    api_name => "open-ils.dashboard.user.widget.get",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
        ],
        return => { desc => 'Array of user widget configurations'}
    }
);

sub user_widget_get {
    my ($self, $conn, $authtoken) = @_;

    $logger->info("Dashboard.pm: user_widget_get CALLED");

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
    my $user_widgets = $e->search_dashboard_user_widget({
        usr => $user_id
    }, {
        order_by => {duw => 'display_order'}
    });

    my @widget_codes;

    if ($user_widgets && @$user_widgets) {
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
        my $widget = $e->retrieve_dashboard_widget($code);
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

__PACKAGE__->register_method(
    method   => "user_widget_update",
    api_name => "open-ils.dashboard.user.widget.update",
    signature => {
        params => [
            {type => 'string', desc => 'Authentication token'},
            {type => 'array', desc => 'Array of widget codes in display order'},
        ],
        return => { desc => 'Success status'}
    }
);

sub user_widget_update {
    my ($self, $conn, $authtoken, $widget_codes) = @_;

    $logger->info("Dashboard.pm: user_widget_update CALLED");
    $logger->info("Widget codes: " . Dumper($widget_codes));

    # Validate authentication
    my $e = new_editor(authtoken => $authtoken, xact => 1);
    unless ($e->checkauth) {
        $logger->error("Dashboard.pm: Authentication failed");
        return $e->die_event;
    }

    my $user_id = $e->requestor->id;

    # Delete existing user widget preferences
    my $existing = $e->search_dashboard_user_widget({usr => $user_id});
    foreach my $widget (@$existing) {
        $e->delete_dashboard_user_widget($widget) or return $e->die_event;
    }

    # Insert new preferences
    my $display_order = 0;
    foreach my $code (@$widget_codes) {
        # Verify widget exists
        my $widget = $e->retrieve_dashboard_widget($code);
        unless ($widget) {
            $logger->error("Dashboard.pm: Widget '$code' not found");
            $e->rollback;
            return new OpenILS::Event("NOT_FOUND", desc => "Widget '$code' not found");
        }

        # Create user widget entry
        my $user_widget = Fieldmapper::dashboard::user_widget->new;
        $user_widget->usr($user_id);
        $user_widget->widget_code($code);
        $user_widget->display_order($display_order++);
        $user_widget->created('now');
        $user_widget->modified('now');

        $e->create_dashboard_user_widget($user_widget) or return $e->die_event;
    }

    $e->commit;
    $logger->info("Dashboard.pm: Successfully updated user widgets");

    return {success => 1, count => scalar(@$widget_codes)};
}

1;
