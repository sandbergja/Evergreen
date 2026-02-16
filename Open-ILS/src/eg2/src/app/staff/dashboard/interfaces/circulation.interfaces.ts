import { ChartData } from '@eg/share/eg-charts/interfaces/chart-data.interface';

// Circulation dashboard data structures based on dashboard-circs.json
export interface CirculationReportMetadata {
    system: string;
    consortium_name: string;
    report_type: string;
    report_period: string;
    report_period_start: string;
    report_period_end: string;
    generated_date: string;
    generated_by: string;
    report_version: string;
    total_circulation: number;
    data_freshness: string;
    org_unit_tree_version: string;
}

export interface CirculationSummary {
    checkouts: number;
    staff_renewals: number;
    auto_renewals: number;
    web_renewals: number;
    holds_filled: number;
}

export interface LibraryCirculationData {
    library_name: string;
    org_unit_id: number;
    org_unit_type: string;
    parent_org_unit_id: number | null;
    shortname: string;
    checkouts: number;
    renewals: number;
    web_renewals: number;
    auto_renewals: number;
    total: number;
    percentage_of_total: number;
    items_per_capita: number;
    service_population: number;
}

export interface DailyCirculationData {
    date: string;
    checkouts: number;
    renewals: number;
    holds_filled: number;
}

export interface PerformanceMetrics {
    circulation_velocity: number;
    collection_turnover_rate: number;
    holds_fill_rate: number;
    renewal_rate: number;
    auto_renewal_success_rate: number;
    average_checkout_duration: number;
}

export interface CirculationByFormat {
    format: string;
    format_code: string;
    circulation: number;
    percentage_of_total: number;
    trend_indicator: string;
}

export interface CirculationByAgeGroup {
    adult_total: number;
    ya_total: number;
    child_total: number;
    grand_total: number;
}

export interface CirculationByAgeGroupFormat {
    format: string;
    adult: number;
    ya: number;
    child: number;
    total: number;
}

export interface DashboardWidgets {
    kpi_summary: {
        total_circulation: number;
        circulation_change_percent: number;
        top_performing_library: string;
        most_popular_format: string;
        digital_adoption_rate: number;
    };
    quick_stats: {
        active_holds: number;
        renewal_rate: number;
        consortium_libraries: number;
        reciprocal_borrowing_usage: number;
    };
}

export interface CirculationDashboardData {
    report_metadata: CirculationReportMetadata;
    circulation_summary: CirculationSummary;
    circulation_by_library: LibraryCirculationData[];
    time_series_data: {
        daily_circulation: DailyCirculationData[];
        monthly_comparison: {
            current_month: { period: string; total: number; };
            previous_month: { period: string; total: number; };
            same_month_previous_year: { period: string; total: number; };
        };
    };
    performance_metrics: PerformanceMetrics;
    circ_modifier: CirculationByFormat[];
    circulation_by_aris: {
        summary: CirculationByAgeGroup;
        by_format: CirculationByAgeGroupFormat[];
    };
    dashboard_widgets: DashboardWidgets;
    charts: {
        circulationTrend: ChartData;
        libraryPerformance: ChartData;
        formatBreakdown: ChartData;
        ageGroupAnalysis: ChartData;
        performanceMetrics: ChartData;
    };
}
