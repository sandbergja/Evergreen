import { Component, ViewChild, ElementRef, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseWidgetComponent } from './base-widget.component';
import { ChartData, ChartConfiguration } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';
import { EgChartComponent } from '@eg/share/eg-charts/eg-chart.component';

/**
 * ChartWidgetComponent - Base Class for Chart-Based Widgets
 *
 * Extends BaseWidgetComponent to provide chart-specific functionality.
 * Integrates with the eg-charts system and provides standardized chart configuration.
 *
 * Design Patterns:
 * - Template Method: Defines chart widget lifecycle
 * - Strategy: Allows different chart rendering strategies
 * - Observer: Observes data changes and updates charts
 */
@Component({
    template: `
        <div class="eg-widget-container" [class.loading]="isLoading" [class.error]="hasError">
            <!-- Widget Header -->
            <div class="eg-widget-header" *ngIf="showHeader">
                <h3 class="eg-widget-title">{{ config?.title || config?.name }}</h3>
                <div class="eg-widget-actions">
                    <button *ngIf="config?.displayOptions?.showExportButton"
                            class="btn btn-sm btn-outline-secondary"
                            (click)="exportChartData()"
                            [disabled]="isLoading"
                            title="Export Data">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary"
                            (click)="refresh()"
                            [disabled]="isLoading"
                            title="Refresh">
                        <i class="fas fa-sync-alt" [class.fa-spin]="isLoading"></i>
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div *ngIf="isLoading" class="eg-widget-loading">
                <div class="d-flex justify-content-center align-items-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <span class="ml-3">Loading chart data...</span>
                </div>
            </div>

            <!-- Error State -->
            <div *ngIf="hasError && !isLoading" class="eg-widget-error">
                <div class="alert alert-danger m-3">
                    <h5><i class="fas fa-exclamation-triangle"></i> Error Loading Widget</h5>
                    <p>{{ currentError?.message || 'An unknown error occurred' }}</p>
                    <button class="btn btn-sm btn-danger" (click)="refresh()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            </div>

            <!-- Chart Content -->
            <div *ngIf="!isLoading && !hasError" class="eg-widget-content">
                <eg-chart
                    #chartComponent
                    [chartData]="chartData"
                    [config]="chartConfig"
                    [chartType]="config?.chartType || 'bar'"
                    (chartError)="onChartError($event)"
                    (dataPointClick)="onDataPointClick($event)">
                </eg-chart>
            </div>

            <!-- No Data State -->
            <div *ngIf="!isLoading && !hasError && !chartData" class="eg-widget-no-data">
                <div class="text-center p-4 text-muted">
                    <i class="fas fa-chart-bar fa-3x mb-3"></i>
                    <p>No data available for the selected time period and filters.</p>
                    <button class="btn btn-sm btn-outline-primary" (click)="refresh()">
                        <i class="fas fa-refresh"></i> Refresh Data
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .eg-widget-container {
            background: var(--bs-card-bg, #fff);
            border: 1px solid var(--bs-border-color, #dee2e6);
            border-radius: var(--bs-border-radius, 0.375rem);
            box-shadow: var(--bs-box-shadow-sm, 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075));
            transition: all 0.2s ease-in-out;
        }

        .eg-widget-container.loading {
            opacity: 0.8;
        }

        .eg-widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid var(--bs-border-color, #dee2e6);
            background: var(--bs-light, #f8f9fa);
        }

        .eg-widget-title {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--bs-dark, #212529);
        }

        .eg-widget-actions {
            display: flex;
            gap: 0.5rem;
        }

        .eg-widget-content {
            padding: 1rem;
        }

        .eg-widget-loading,
        .eg-widget-error,
        .eg-widget-no-data {
            min-height: 200px;
        }

        .eg-widget-loading {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        @media (max-width: 768px) {
            .eg-widget-header {
                flex-direction: column;
                gap: 0.75rem;
                align-items: flex-start;
            }

            .eg-widget-actions {
                align-self: flex-end;
            }
        }
    `]
})
export abstract class ChartWidgetComponent extends BaseWidgetComponent {

    @ViewChild('chartComponent') chartComponent?: EgChartComponent;
    @Input() showHeader = true;

    // Chart-specific properties
    protected chartData: ChartData | null = null;
    protected chartConfig: ChartConfiguration = {
        width: 800,
        height: 400,
        margin: { top: 20, right: 20, bottom: 40, left: 60 },
        showGrid: true,
        showTooltip: true,
        animated: true
    };

    // Evergreen chart color palette
    protected readonly CHART_COLORS = [
        'var(--primary)',      // Dark blue
        'var(--success)',      // Dark green
        'var(--info)',         // Dark cyan
        'var(--warning-color)', // Yellow
        'var(--danger)',       // Dark red
        '#6c757d',             // Medium gray
        '#495057'              // Dark gray
    ];

    /**
     * Override base widget setup to configure chart-specific settings
     */
    protected setupWidget(): void {
        super.setupWidget();
        this.configureChart();
    }

    /**
     * Handle data loaded - transform data to ChartData format
     */
    protected onDataLoaded(data: any): void {
        super.onDataLoaded(data);

        try {
            this.chartData = this.transformDataToChart(data);
            this.validateChartData();
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    /**
     * Configure chart based on widget configuration
     */
    private configureChart(): void {
        if (!this.config) return;

        // Apply display options
        const displayOptions = this.config.displayOptions;
        if (displayOptions) {
            this.chartConfig.showGrid = displayOptions.showGrid;
            this.chartConfig.showTooltip = true; // Always show tooltips
        }

        // Apply color theme
        if (this.config.colorTheme) {
            this.applyColorTheme(this.config.colorTheme);
        }

        // Configure chart type specific options
        this.configureChartType();
    }

    /**
     * Apply color theme to chart
     */
    private applyColorTheme(theme: string): void {
        // This could be extended to support different color themes
        // For now, we use the default Evergreen colors
    }

    /**
     * Configure chart type specific options
     */
    private configureChartType(): void {
        if (!this.config) return;

        switch (this.config.chartType) {
            case 'bar':
                this.chartConfig.barStyle = {
                    orientation: 'vertical',
                    grouping: 'grouped',
                    cornerRadius: 2,
                    opacity: 0.8
                };
                break;
            case 'line':
                this.chartConfig.lineStyle = {
                    strokeWidth: 2,
                    opacity: 1
                };
                break;
            case 'pie':
                this.chartConfig.pieStyle = {
                    innerRadius: 0,
                    showLabels: true,
                    showLegend: this.config.displayOptions?.showLegend ?? true
                };
                break;
        }
    }

    /**
     * Validate chart data
     */
    private validateChartData(): void {
        if (!this.chartData) {
            throw new Error('Chart data is null');
        }

        if (!this.chartData.series || this.chartData.series.length === 0) {
            throw new Error('Chart data must contain at least one series');
        }

        for (const series of this.chartData.series) {
            if (!series.data || series.data.length === 0) {
                console.warn(`Series "${series.name}" has no data points`);
            }
        }
    }

    /**
     * Handle chart-specific errors
     */
    public onChartError(error: any): void {
        this.handleError(new Error(`Chart rendering error: ${error}`));
    }

    /**
     * Handle data point clicks
     */
    public onDataPointClick(event: any): void {
        // Can be overridden by subclasses for custom behavior
        console.log('Data point clicked:', event);
    }

    /**
     * Export chart data
     */
    public exportChartData(): void {
        if (this.chartComponent) {
            this.chartComponent.downloadChartData();
        }
    }

    /**
     * Get chart performance metrics
     */
    public getChartMetrics(): any {
        return this.chartComponent?.getPerformanceMetrics() || null;
    }

    /**
     * Apply filters to data and refresh chart
     */
    protected applyFilters(data: any): any {
        if (!this.config?.filters || this.config.filters.length === 0) {
            return data;
        }

        // This is a generic implementation - subclasses can override
        // for more sophisticated filtering
        return this.filterDataByConfig(data);
    }

    /**
     * Generic data filtering based on config
     */
    private filterDataByConfig(data: any): any {
        // Implementation depends on data structure
        // This is a placeholder that subclasses should override
        return data;
    }

    /**
     * Get chart data for accessibility
     */
    public getAccessibleData(): any[] {
        if (!this.chartData) return [];

        const tableData = [];
        const maxLength = Math.max(...this.chartData.series.map(s => s.data.length));

        for (let i = 0; i < maxLength; i++) {
            const row: any = {};

            // Add x-axis value
            const firstPoint = this.chartData.series[0]?.data[i];
            if (firstPoint) {
                row.category = firstPoint.x;
            }

            // Add series values
            this.chartData.series.forEach(series => {
                const point = series.data[i];
                row[series.name] = point ? point.y : '';
            });

            tableData.push(row);
        }

        return tableData;
    }

    // Abstract Methods - Must be implemented by subclasses

    /**
     * Transform raw data to ChartData format
     */
    protected abstract transformDataToChart(data: any): ChartData;

    /**
     * Validate widget configuration for chart widgets
     */
    protected validateWidgetConfig(config: ChartWidgetConfig): void {
        // Base validation for all chart widgets
        if (!['line', 'bar', 'pie', 'metric'].includes(config.chartType)) {
            throw new Error(`Unsupported chart type: ${config.chartType}`);
        }

        if (!['week', 'month', 'quarter', 'year', 'custom'].includes(config.timeRange)) {
            throw new Error(`Invalid time range: ${config.timeRange}`);
        }

        if (config.timeRange === 'custom' && !config.customDateRange) {
            throw new Error('Custom date range is required when timeRange is "custom"');
        }

        // Call subclass validation
        this.validateChartWidgetConfig(config);
    }

    /**
     * Subclass-specific chart widget validation
     */
    protected abstract validateChartWidgetConfig(config: ChartWidgetConfig): void;
}