/**
 * JSON-Driven Widget Configuration System
 *
 * This interface system enables dashboard widgets to be created and configured
 * entirely from JSON, without requiring TypeScript classes. This supports:
 * - Visual dashboard designer
 * - Export/import dashboard configurations
 * - Dynamic widget creation
 * - Widget templates library
 */

/**
 * Transform strategy types for data manipulation
 */
export type TransformType = 'groupBy' | 'sum' | 'average' | 'count' | 'filter' | 'sort' | 'map' | 'reduce' | 'multiSeries';

/**
 * Available data source services
 */
export type DataSourceService = 'circulation' | 'acquisitions' | 'cataloging' | 'patrons' | 'holdings';

/**
 * Aggregation functions
 */
export type AggregationFunction = 'sum' | 'average' | 'count' | 'min' | 'max' | 'first' | 'last';

/**
 * Data source configuration - defines where and how to fetch data
 */
export interface DataSourceConfig {
    // Service to fetch data from
    service: DataSourceService;

    // Method to call on the service
    method: string;

    // Parameters to pass to the method
    params: Record<string, any>;

    // Optional caching configuration
    cache?: {
        enabled: boolean;
        ttl?: number; // Time to live in seconds
    };
}

/**
 * Transform configuration - defines how to transform raw data
 */
export interface TransformConfig {
    // Type of transformation to apply
    type: TransformType;

    // Field to use as X-axis/category (for charts)
    xField?: string;

    // Field to use as Y-axis/value (for charts and metrics)
    yField: string;

    // Field to group by (for groupBy transform)
    groupByField?: string;

    // Field to split into multiple series (for multiSeries transform)
    seriesField?: string;

    // Aggregation function to apply
    aggregation?: AggregationFunction;

    // Filter expression (for filter transform)
    filterExpression?: string;

    // Sort configuration
    sortBy?: {
        field: string;
        order: 'asc' | 'desc';
    };

    // Custom mapping function (as string expression)
    mapExpression?: string;

    // Limit results
    limit?: number;
}

/**
 * Visualization configuration - defines how to display the data
 */
export interface VisualizationConfig {
    // Chart type
    chartType: 'bar' | 'line' | 'pie' | 'metric';

    // Display title
    title: string;

    // Subtitle (optional)
    subtitle?: string;

    // X-axis label (for charts)
    xAxisLabel?: string;

    // Y-axis label (for charts)
    yAxisLabel?: string;

    // Color theme or specific colors
    colors?: string[];

    // Icon for metric widgets
    icon?: string;

    // Color for metric widgets
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';

    // Show legend
    showLegend?: boolean;

    // Show grid
    showGrid?: boolean;

    // Show tooltip
    showTooltip?: boolean;

    // Animation enabled
    animated?: boolean;

    // Metric-specific options
    metricOptions?: {
        format?: 'number' | 'currency' | 'percentage';
        precision?: number;
        showTrend?: boolean;
        showStatus?: boolean;
        showTopIcon?: boolean;
    };
}

/**
 * Filter configuration for JSON widgets
 */
export interface JsonFilterConfig {
    // Filter identifier
    id: string;

    // Filter type
    type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'number';

    // Filter label
    label: string;

    // Data field this filter applies to
    field: string;

    // Available options (for select/multiselect)
    options?: Array<{
        value: string | number;
        label: string;
    }>;

    // Default value
    defaultValue?: any;

    // Placeholder text
    placeholder?: string;

    // Required filter
    required?: boolean;
}

/**
 * Complete JSON Widget Configuration
 */
export interface WidgetJsonConfig {
    // Widget identification
    id: string;
    name: string;

    // Widget type
    type: 'chart' | 'metric';

    // Description
    description?: string;

    // Category for organization
    category?: 'circulations' | 'acquisitions' | 'cataloging' | 'patrons' | 'holdings';

    // Data source configuration
    dataSource: DataSourceConfig;

    // Data transformation
    transform: TransformConfig;

    // Visualization configuration
    visualization: VisualizationConfig;

    // Filters configuration
    filters?: JsonFilterConfig[];

    // Time range configuration
    timeRange?: {
        type: 'today' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
        customStart?: string;
        customEnd?: string;
    };

    // Layout configuration (for dashboard positioning)
    layout?: {
        row: number;
        column: number;
        width: number;
        height: number;
    };

    // Auto-refresh configuration
    autoRefresh?: {
        enabled: boolean;
        interval: number; // seconds
    };

    // Access control
    permissions?: {
        viewPermission?: string;
        editPermission?: string;
    };

    // Metadata
    metadata?: {
        author?: string;
        created?: string;
        modified?: string;
        version?: string;
        tags?: string[];
    };
}

/**
 * Dashboard JSON configuration - complete dashboard layout
 */
export interface DashboardJsonConfig {
    // Dashboard identification
    id: string;
    name: string;
    description?: string;

    // Layout configuration
    layout: {
        type: 'grid' | 'flow';
        columns?: number;
        gap?: number;
    };

    // Widgets in this dashboard
    widgets: WidgetJsonConfig[];

    // Dashboard-level filters (apply to all widgets)
    globalFilters?: JsonFilterConfig[];

    // Auto-refresh for entire dashboard
    autoRefresh?: {
        enabled: boolean;
        interval: number;
    };

    // Metadata
    metadata: {
        author: string;
        created: string;
        modified: string;
        version: string;
        tags?: string[];
    };
}

/**
 * Widget template - reusable widget configuration
 */
export interface WidgetTemplateConfig {
    // Template identification
    templateId: string;
    templateName: string;
    description: string;

    // Category
    category: string;

    // Icon for template library
    icon?: string;

    // Preview image
    previewImage?: string;

    // Base configuration (can be customized)
    config: Partial<WidgetJsonConfig>;

    // Customizable fields
    customizableFields?: string[];

    // Tags for search
    tags: string[];
}

/**
 * Validation result for widget configurations
 */
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings?: ValidationWarning[];
}

export interface ValidationError {
    field: string;
    message: string;
    severity: 'error';
}

export interface ValidationWarning {
    field: string;
    message: string;
    severity: 'warning';
}

/**
 * Transform result with metadata
 */
export interface TransformResult {
    data: any;
    metadata: {
        recordCount: number;
        transformType: TransformType;
        executionTime?: number;
        errors?: string[];
    };
}

/**
 * Data fetch result with metadata
 */
export interface DataFetchResult {
    data: any;
    metadata: {
        source: DataSourceService;
        method: string;
        fetchTime: Date;
        recordCount: number;
        cached?: boolean;
    };
}

/**
 * Metric widget data display format
 */
export interface MetricData {
    value: number | string;
    title: string;
    subtitle?: string;
    icon?: string;
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
    status?: string;
    statusIcon?: string;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: string;
}