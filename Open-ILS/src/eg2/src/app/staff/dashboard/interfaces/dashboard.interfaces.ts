import { ChartData } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { AppliedFilter } from './filter.interfaces';

/**
 * ============================================================================
 * DEPRECATED INTERFACES - Legacy TypeScript Widget System
 * ============================================================================
 *
 * These interfaces are deprecated and should NOT be used for new code.
 * They were part of the old TypeScript widget system that has been replaced
 * by the JSON widget system (WidgetJsonConfig).
 *
 * Use WidgetJsonConfig instead for all new widgets.
 *
 * These interfaces are kept only for backward compatibility and may be
 * removed in a future version.
 * ============================================================================
 */

/**
 * @deprecated Use WidgetJsonConfig instead
 * Legacy interface from TypeScript widget system
 */
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

/**
 * @deprecated Use WidgetJsonConfig instead
 * Legacy configuration interface for TypeScript-based widgets.
 * All widgets are now JSON-driven and stored in the database.
 */
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

    // Organizational unit filtering
    orgUnit?: number;
    includeDescendants?: boolean;

    // Layout configuration
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
