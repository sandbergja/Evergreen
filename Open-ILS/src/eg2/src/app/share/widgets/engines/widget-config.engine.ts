import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { WidgetJsonConfig, MetricData } from '@eg/staff/dashboard/interfaces/widget-json-config.interface';
import { ChartData, ChartSeries, ChartPoint } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { DataSourceRegistryService } from '../services/data-source-registry.service';
import { TransformEngine } from './transform.engine';

/**
 * WidgetConfigEngine - Orchestrates JSON widget rendering
 *
 * This service acts as the main orchestrator for JSON-driven widgets. It:
 * 1. Fetches data from the data source
 * 2. Applies transformations
 * 3. Converts to chart or metric format
 * 4. Handles errors
 *
 * This is the "brain" of the JSON widget system that connects all the pieces.
 */

@Injectable({
    providedIn: 'root'
})
export class WidgetConfigEngine {

    private dataSourceRegistry = inject(DataSourceRegistryService);
    private transformEngine = inject(TransformEngine);

    /**
     * Execute a widget configuration and return chart data
     */
    public executeChartWidget(config: WidgetJsonConfig): Observable<ChartData> {
        if (config.type !== 'chart') {
            throw new Error('executeChartWidget requires config.type to be "chart"');
        }

        return this.fetchAndTransformData(config).pipe(
            map(transformedData => this.toChartData(transformedData, config)),
            catchError(error => {
                console.error('Error executing chart widget:', error);
                throw error;
            })
        );
    }

    /**
     * Execute a widget configuration and return metric data
     */
    public executeMetricWidget(config: WidgetJsonConfig): Observable<MetricData> {
        if (config.type !== 'metric') {
            throw new Error('executeMetricWidget requires config.type to be "metric"');
        }

        return this.fetchAndTransformData(config).pipe(
            map(transformedData => this.toMetricData(transformedData, config)),
            catchError(error => {
                console.error('Error executing metric widget:', error);
                throw error;
            })
        );
    }

    /**
     * Fetch data from data source and apply transformations
     */
    private fetchAndTransformData(config: WidgetJsonConfig): Observable<any> {
        // Fetch data from the data source
        return this.dataSourceRegistry.fetchData(config.dataSource).pipe(
            map(fetchResult => {
                // Apply transformation
                const transformResult = this.transformEngine.transform(
                    fetchResult.data,
                    config.transform
                );

                return transformResult.data;
            })
        );
    }

    /**
     * Convert transformed data to ChartData format
     */
    public toChartData(transformedData: any[], config: WidgetJsonConfig): ChartData {
        const viz = config.visualization;

        // Determine if we have grouped data or simple data
        const isGroupedData = transformedData.length > 0 && transformedData[0]._items;

        let series: ChartSeries[];

        if (isGroupedData) {
            // Data is grouped - create chart series
            series = this.createChartSeriesFromGroupedData(transformedData, config);
        } else if (transformedData.length === 1 && typeof transformedData[0][config.transform.yField] === 'number') {
            // Single aggregated value - create simple series
            series = [{
                name: viz.title || 'Value',
                data: [{
                    x: viz.title || 'Total',
                    y: transformedData[0][config.transform.yField],
                    label: `${transformedData[0][config.transform.yField]}`
                }]
            }];
        } else {
            // Array of data points - create series from array
            series = this.createChartSeriesFromArray(transformedData, config);
        }

        // Apply colors if specified
        if (viz.colors && viz.colors.length > 0) {
            series.forEach((s, index) => {
                s.color = viz.colors![index % viz.colors!.length];
            });
        }

        return {
            series,
            title: viz.title,
            xAxisLabel: viz.xAxisLabel,
            yAxisLabel: viz.yAxisLabel,
            accessibility: {
                description: viz.subtitle || `${viz.title} chart`,
                patterns: false // Can be made configurable
            }
        };
    }

    /**
     * Create chart series from grouped data
     */
    private createChartSeriesFromGroupedData(data: any[], config: WidgetJsonConfig): ChartSeries[] {
        const xField = config.transform.xField || 'x';
        const yField = config.transform.yField;

        const dataPoints: ChartPoint[] = data.map(item => ({
            x: item[xField],
            y: item[yField],
            label: `${item[xField]}: ${item[yField]}`
        }));

        return [{
            name: config.visualization.title || config.name,
            data: dataPoints
        }];
    }

    /**
     * Create chart series from array of data
     */
    private createChartSeriesFromArray(data: any[], config: WidgetJsonConfig): ChartSeries[] {
        const xField = config.transform.xField || 'x';
        const yField = config.transform.yField;

        const dataPoints: ChartPoint[] = data.map(item => ({
            x: item[xField] || item.id || item.name || 'Unknown',
            y: item[yField],
            label: `${item[xField]}: ${item[yField]}`
        }));

        return [{
            name: config.visualization.title || config.name,
            data: dataPoints
        }];
    }

    /**
     * Convert transformed data to MetricData format
     */
    public toMetricData(transformedData: any[], config: WidgetJsonConfig): MetricData {
        const viz = config.visualization;
        const yField = config.transform.yField;

        // Extract the value
        let value: number | string;
        if (transformedData.length === 1) {
            value = transformedData[0][yField];
        } else if (transformedData.length > 1) {
            // Multiple values - sum them or take first
            value = transformedData.reduce((sum, item) => sum + (item[yField] || 0), 0);
        } else {
            value = 0;
        }

        // Format the value if format option is specified
        if (viz.metricOptions?.format) {
            value = this.formatMetricValue(value, viz.metricOptions);
        }

        // Calculate trend for holds data
        let trend: 'up' | 'down' | 'stable' | undefined;
        let trendValue: string | undefined;
        let status: string | undefined;
        let statusIcon: string | undefined;

        if (transformedData.length === 1 && transformedData[0].active !== undefined) {
            // This looks like holds data - calculate trend
            const data = transformedData[0];
            const active = data.active || 0;
            const onShelf = data.on_shelf || 0;
            const inTransit = data.in_transit || 0;

            if (active > 0) {
                const percentageReady = Math.round((onShelf / active) * 100);
                trendValue = `${percentageReady}% ready`;

                // Determine trend direction based on percentage
                if (percentageReady > 20) {
                    trend = 'up';
                } else if (percentageReady < 10) {
                    trend = 'down';
                } else {
                    trend = 'stable';
                }

                // Set status
                status = 'Pending';
                statusIcon = viz.icon; // Use same icon as widget
            }
        }

        return {
            value,
            title: viz.title,
            subtitle: viz.subtitle,
            icon: viz.icon,
            color: viz.color,
            status,
            statusIcon,
            trend,
            trendValue
        };
    }

    /**
     * Format metric value according to options
     */
    private formatMetricValue(value: number | string, options: any): string {
        if (typeof value !== 'number') {
            return String(value);
        }

        const precision = options.precision || 0;

        switch (options.format) {
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: precision,
                    maximumFractionDigits: precision
                }).format(value);
            case 'percentage':
                return new Intl.NumberFormat('en-US', {
                    style: 'percent',
                    minimumFractionDigits: precision,
                    maximumFractionDigits: precision
                }).format(value / 100);
            case 'number':
            default:
                return new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: precision,
                    maximumFractionDigits: precision
                }).format(value);
        }
    }

    /**
     * Validate widget configuration before execution
     */
    public validateWidgetConfig(config: WidgetJsonConfig): { valid: boolean, errors: string[] } {
        const errors: string[] = [];

        // Basic validation
        if (!config.id) errors.push('Widget ID is required');
        if (!config.name) errors.push('Widget name is required');
        if (!config.type) errors.push('Widget type is required');

        // Validate data source
        const dataSourceValidation = this.dataSourceRegistry.validateDataSourceConfig(config.dataSource);
        if (!dataSourceValidation.valid) {
            errors.push(...dataSourceValidation.errors);
        }

        // Validate transform
        const transformValidation = this.transformEngine.validateTransformConfig(config.transform);
        if (!transformValidation.valid) {
            errors.push(...transformValidation.errors);
        }

        // Validate visualization
        if (!config.visualization.chartType) {
            errors.push('Visualization chart type is required');
        }

        if (!config.visualization.title) {
            errors.push('Visualization title is required');
        }

        // Type-specific validation
        if (config.type === 'chart') {
            if (!['bar', 'line', 'pie'].includes(config.visualization.chartType)) {
                errors.push(`Invalid chart type for chart widget: ${config.visualization.chartType}`);
            }
        } else if (config.type === 'metric') {
            if (config.visualization.chartType !== 'metric') {
                errors.push('Metric widget must have chartType="metric"');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get widget execution summary (for debugging)
     */
    public getExecutionSummary(config: WidgetJsonConfig): any {
        return {
            widgetId: config.id,
            widgetName: config.name,
            widgetType: config.type,
            dataSource: {
                service: config.dataSource.service,
                method: config.dataSource.method,
                cached: config.dataSource.cache?.enabled || false
            },
            transform: {
                type: config.transform.type,
                fields: {
                    x: config.transform.xField,
                    y: config.transform.yField,
                    groupBy: config.transform.groupByField
                }
            },
            visualization: {
                chartType: config.visualization.chartType,
                title: config.visualization.title
            }
        };
    }

    /**
     * Preview widget data without rendering
     * Useful for dashboard designer
     */
    public previewWidgetData(config: WidgetJsonConfig): Observable<any> {
        return this.fetchAndTransformData(config).pipe(
            map(data => ({
                config: this.getExecutionSummary(config),
                data,
                recordCount: Array.isArray(data) ? data.length : 1,
                preview: Array.isArray(data) ? data.slice(0, 5) : data
            }))
        );
    }
}