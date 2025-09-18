import { ChartData } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { AppliedFilter } from './filter.interfaces';

export interface DashboardData {
    metrics: {
        circulationToday: number;
        activePatrons: number;
        overdueItems: number;
        totalCollection: number;
        currentHolds: number;
    };
    charts: {
        circulationTrend: ChartData;
        collectionBreakdown: ChartData;
        patronActivity: ChartData;
        holdStatus: ChartData;
    };
}

export interface ChartWidgetConfig {
    // Widget identification
    id: string;
    name: string;

    // Core configuration
    widgetType: 'circulations' | 'acquisitions' | 'cataloging' | 'patrons' | 'holdings';
    chartType: 'line' | 'bar' | 'pie' | 'metric';
    title: string;

    // Time configuration
    timeRange: 'today' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
    customDateRange?: {
        start: string;
        end: string;
    };

    // Visual configuration
    colorTheme: string;
    displayOptions: {
        showLegend: boolean;
        showGrid: boolean;
        showExportButton: boolean;
        showPatterns: boolean;
    };

    // Metric widget specific options
    metricOptions?: {
        icon?: string;
        showStatus?: boolean;
        showTrend?: boolean;
        showTopIcon?: boolean;
        color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
        format?: 'number' | 'currency' | 'percentage' | 'custom';
        customFormat?: string;
        precision?: number;
    };

    // Applied filters
    filters: AppliedFilter[];

    // Layout configuration (for future dashboard positioning)
    position?: {
        row: number;
        column: number;
        width: number;
        height: number;
    };

    // Metadata
    createdDate: string;
    lastModified: string;
    createdBy: string;
}