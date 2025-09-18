import { Component, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseWidgetComponent } from './base-widget.component';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';

/**
 * MetricData - Interface for metric widget data
 */
export interface MetricData {
    value: number | string;
    title: string;
    icon?: string;              // Material Icons name (e.g., 'bookmark', 'people')
    status?: string;            // Status text (e.g., "Pending", "Active", "Overdue")
    statusIcon?: string;        // Status icon name
    trend?: 'up' | 'down' | 'stable';
    trendValue?: string;        // e.g., "+5.2%", "-2.1%"
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
    subtitle?: string;          // Additional description
    loading?: boolean;          // Override loading state for individual metrics
}

/**
 * MetricWidgetComponent - Base Class for Metric-Based Widgets
 *
 * Extends BaseWidgetComponent to provide metric-specific functionality.
 * Metric widgets display key performance indicators (KPIs) in a card format
 * with support for icons, status indicators, and trend information.
 *
 * Design Patterns:
 * - Template Method: Defines metric widget lifecycle
 * - Observer: Reactive updates to metric values
 * - Strategy: Different metric display strategies
 */
@Component({
    template: `
        <div class="eg-metric-widget" [class.loading]="isLoading" [class.error]="hasError">
            <!-- Widget Header (optional, usually not shown for metrics) -->
            <div class="eg-widget-header" *ngIf="showHeader">
                <h5 class="eg-widget-title">
                    <span class="material-icons me-2" *ngIf="config?.metricOptions?.icon" aria-hidden="true">
                        {{ config.metricOptions.icon }}
                    </span>
                    {{ config?.title || config?.name }}
                </h5>
                <div class="eg-widget-actions">
                    <button *ngIf="config?.displayOptions?.showExportButton"
                            class="btn btn-sm btn-outline-secondary"
                            (click)="exportMetricData()"
                            [disabled]="isLoading"
                            title="Export Data">
                        <span class="material-icons">download</span>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary"
                            (click)="refresh()"
                            [disabled]="isLoading"
                            title="Refresh">
                        <span class="material-icons" [class.spinning]="isLoading">refresh</span>
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div *ngIf="isLoading" class="eg-metric-loading">
                <div class="metric-card loading-card">
                    <div class="metric-skeleton">
                        <div class="skeleton-value"></div>
                        <div class="skeleton-title"></div>
                        <div class="skeleton-status"></div>
                    </div>
                </div>
            </div>

            <!-- Error State -->
            <div *ngIf="hasError && !isLoading" class="eg-metric-error">
                <div class="metric-card error-card">
                    <div class="metric-error-content">
                        <span class="material-icons error-icon">error</span>
                        <div class="error-message">Error Loading Metric</div>
                        <button class="btn btn-sm btn-outline-danger mt-2" (click)="refresh()">
                            <span class="material-icons">refresh</span> Retry
                        </button>
                    </div>
                </div>
            </div>

            <!-- Metric Content -->
            <div *ngIf="!isLoading && !hasError && metricData" class="eg-metric-content">
                <div class="metric-card"
                     [class]="getMetricCardClasses()"
                     [attr.aria-label]="getAriaLabel()">

                    <!-- Top Icon (optional) -->
                    <div class="metric-top-icon" *ngIf="metricData.icon && showTopIcon">
                        <span class="material-icons"
                              [class]="'text-' + (metricData.color || 'primary')"
                              aria-hidden="true">
                            {{ metricData.icon }}
                        </span>
                    </div>

                    <!-- Main Value -->
                    <div class="metric-value"
                         [class]="'text-' + (metricData.color || 'primary')">
                        {{ formatMetricValue(metricData.value) }}
                    </div>

                    <!-- Title -->
                    <div class="metric-title">
                        {{ metricData.title }}
                    </div>

                    <!-- Subtitle (optional) -->
                    <div class="metric-subtitle" *ngIf="metricData.subtitle">
                        {{ metricData.subtitle }}
                    </div>

                    <!-- Status Indicator -->
                    <div class="metric-status" *ngIf="metricData.status">
                        <span class="material-icons status-icon"
                              *ngIf="metricData.statusIcon"
                              [class]="getStatusIconClass()"
                              aria-hidden="true">
                            {{ metricData.statusIcon }}
                        </span>
                        <span class="status-text" [class]="getStatusTextClass()">
                            {{ metricData.status }}
                        </span>
                    </div>

                    <!-- Trend Indicator -->
                    <div class="metric-trend" *ngIf="metricData.trend && config?.metricOptions?.showTrend">
                        <span class="material-icons trend-icon"
                              [class]="getTrendIconClass()"
                              aria-hidden="true">
                            {{ getTrendIcon() }}
                        </span>
                        <span class="trend-text"
                              [class]="getTrendTextClass()"
                              *ngIf="metricData.trendValue">
                            {{ metricData.trendValue }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- No Data State -->
            <div *ngIf="!isLoading && !hasError && !metricData" class="eg-metric-no-data">
                <div class="metric-card no-data-card">
                    <div class="no-data-content">
                        <span class="material-icons no-data-icon">help_outline</span>
                        <div class="no-data-message">No data available</div>
                        <button class="btn btn-sm btn-outline-primary mt-2" (click)="refresh()">
                            <span class="material-icons">refresh</span> Refresh
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .eg-metric-widget {
            width: 100%;
            height: 100%;
        }

        .metric-card {
            background: var(--bs-card-bg, #fff);
            border: 1px solid var(--bs-border-color, #dee2e6);
            border-radius: var(--bs-border-radius, 0.375rem);
            padding: 1.5rem;
            text-align: center;
            box-shadow: var(--bs-box-shadow-sm, 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075));
            transition: all 0.2s ease-in-out;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .metric-card:hover {
            box-shadow: var(--bs-box-shadow, 0 0.5rem 1rem rgba(0, 0, 0, 0.15));
            transform: translateY(-1px);
        }

        .metric-top-icon {
            margin-bottom: 0.75rem;
        }

        .metric-top-icon .material-icons {
            font-size: 2rem;
        }

        .metric-value {
            font-size: 3rem;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 0.5rem;
        }

        .metric-title {
            font-size: 1rem;
            color: var(--bs-secondary, #6c757d);
            margin-bottom: 0.75rem;
            font-weight: 500;
        }

        .metric-subtitle {
            font-size: 0.875rem;
            color: var(--bs-muted, #6c757d);
            margin-bottom: 0.5rem;
        }

        .metric-status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            margin-top: 0.5rem;
        }

        .status-icon {
            font-size: 1rem;
        }

        .status-text {
            font-size: 0.875rem;
            font-weight: 500;
        }

        .metric-trend {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            margin-top: 0.5rem;
            font-size: 0.875rem;
        }

        .trend-icon {
            font-size: 1rem;
        }

        .trend-up {
            color: var(--bs-success, #198754);
        }

        .trend-down {
            color: var(--bs-danger, #dc3545);
        }

        .trend-stable {
            color: var(--bs-secondary, #6c757d);
        }

        /* Loading States */
        .loading-card {
            opacity: 0.7;
        }

        .metric-skeleton {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
        }

        .skeleton-value,
        .skeleton-title,
        .skeleton-status {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: skeleton-loading 1.5s infinite;
            border-radius: 0.25rem;
        }

        .skeleton-value {
            width: 80px;
            height: 48px;
        }

        .skeleton-title {
            width: 120px;
            height: 16px;
        }

        .skeleton-status {
            width: 60px;
            height: 14px;
        }

        @keyframes skeleton-loading {
            0% {
                background-position: 200% 0;
            }
            100% {
                background-position: -200% 0;
            }
        }

        /* Error States */
        .error-card {
            border-color: var(--bs-danger, #dc3545);
            background-color: var(--bs-danger-bg-subtle, #f8d7da);
        }

        .metric-error-content {
            color: var(--bs-danger, #dc3545);
        }

        .error-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .error-message {
            font-weight: 500;
            margin-bottom: 0.5rem;
        }

        /* No Data States */
        .no-data-card {
            border-color: var(--bs-secondary, #6c757d);
            background-color: var(--bs-light, #f8f9fa);
        }

        .no-data-content {
            color: var(--bs-secondary, #6c757d);
        }

        .no-data-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .no-data-message {
            font-weight: 500;
            margin-bottom: 0.5rem;
        }

        /* Header (when shown) */
        .eg-widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            margin-bottom: 1rem;
            border-bottom: 1px solid var(--bs-border-color, #dee2e6);
            background: var(--bs-light, #f8f9fa);
            border-radius: var(--bs-border-radius, 0.375rem) var(--bs-border-radius, 0.375rem) 0 0;
        }

        .eg-widget-title {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--bs-dark, #212529);
        }

        .eg-widget-actions {
            display: flex;
            gap: 0.5rem;
        }

        .spinning {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        /* Responsive Design */
        @media (max-width: 576px) {
            .metric-card {
                padding: 1rem;
            }

            .metric-value {
                font-size: 2.5rem;
            }

            .metric-title {
                font-size: 0.875rem;
            }
        }

        /* Color Variants */
        .metric-card.variant-primary { border-left: 4px solid var(--bs-primary, #0d6efd); }
        .metric-card.variant-success { border-left: 4px solid var(--bs-success, #198754); }
        .metric-card.variant-warning { border-left: 4px solid var(--bs-warning, #ffc107); }
        .metric-card.variant-danger { border-left: 4px solid var(--bs-danger, #dc3545); }
        .metric-card.variant-info { border-left: 4px solid var(--bs-info, #0dcaf0); }
        .metric-card.variant-secondary { border-left: 4px solid var(--bs-secondary, #6c757d); }
    `]
})
export abstract class MetricWidgetComponent extends BaseWidgetComponent {

    @Input() showHeader = false; // Metrics usually don't show headers
    @Input() showTopIcon = false; // Whether to show icon at top of card

    // Metric-specific properties
    protected metricData: MetricData | null = null;

    /**
     * Override base widget setup to configure metric-specific settings
     */
    protected setupWidget(): void {
        super.setupWidget();
        this.configureMetric();
    }

    /**
     * Handle data loaded - transform data to MetricData format
     */
    protected onDataLoaded(data: any): void {
        super.onDataLoaded(data);

        try {
            this.metricData = this.transformDataToMetric(data);
            this.validateMetricData();
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    /**
     * Configure metric based on widget configuration
     */
    private configureMetric(): void {
        if (!this.config) return;

        // Apply metric-specific display options
        const metricOptions = this.config.metricOptions;
        if (metricOptions) {
            this.showTopIcon = metricOptions.showTopIcon || false;
        }
    }

    /**
     * Validate metric data
     */
    private validateMetricData(): void {
        if (!this.metricData) {
            throw new Error('Metric data is null');
        }

        if (this.metricData.value === null || this.metricData.value === undefined) {
            throw new Error('Metric value is required');
        }

        if (!this.metricData.title) {
            throw new Error('Metric title is required');
        }
    }

    /**
     * Format metric value based on configuration
     */
    protected formatMetricValue(value: number | string): string {
        if (typeof value === 'string') {
            return value;
        }

        const format = this.config?.metricOptions?.format || 'number';
        const precision = this.config?.metricOptions?.precision || 0;

        switch (format) {
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
     * Get CSS classes for the metric card
     */
    protected getMetricCardClasses(): string {
        const classes = ['metric-card'];

        if (this.metricData?.color) {
            classes.push(`variant-${this.metricData.color}`);
        }

        return classes.join(' ');
    }

    /**
     * Get aria-label for accessibility
     */
    protected getAriaLabel(): string {
        if (!this.metricData) return '';

        let label = `${this.metricData.title}: ${this.formatMetricValue(this.metricData.value)}`;

        if (this.metricData.status) {
            label += `, Status: ${this.metricData.status}`;
        }

        if (this.metricData.trend && this.metricData.trendValue) {
            label += `, Trend: ${this.metricData.trend} ${this.metricData.trendValue}`;
        }

        return label;
    }

    /**
     * Get status icon CSS class
     */
    protected getStatusIconClass(): string {
        if (!this.metricData?.color) return '';
        return `text-${this.metricData.color}`;
    }

    /**
     * Get status text CSS class
     */
    protected getStatusTextClass(): string {
        if (!this.metricData?.color) return '';
        return `text-${this.metricData.color}`;
    }

    /**
     * Get trend icon based on trend direction
     */
    protected getTrendIcon(): string {
        switch (this.metricData?.trend) {
            case 'up':
                return 'trending_up';
            case 'down':
                return 'trending_down';
            case 'stable':
            default:
                return 'trending_flat';
        }
    }

    /**
     * Get trend icon CSS class
     */
    protected getTrendIconClass(): string {
        switch (this.metricData?.trend) {
            case 'up':
                return 'trend-up';
            case 'down':
                return 'trend-down';
            case 'stable':
            default:
                return 'trend-stable';
        }
    }

    /**
     * Get trend text CSS class
     */
    protected getTrendTextClass(): string {
        switch (this.metricData?.trend) {
            case 'up':
                return 'text-success';
            case 'down':
                return 'text-danger';
            case 'stable':
            default:
                return 'text-secondary';
        }
    }

    /**
     * Export metric data (can be overridden)
     */
    public exportMetricData(): void {
        if (!this.metricData) return;

        const exportData = {
            timestamp: new Date().toISOString(),
            widget: this.config?.name || 'Metric Widget',
            metric: this.metricData
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.config?.name || 'metric'}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Validate widget configuration for metric widgets
     */
    protected validateWidgetConfig(config: ChartWidgetConfig): void {
        // Base validation for all metric widgets
        if (config.chartType !== 'metric') {
            throw new Error(`MetricWidgetComponent requires chartType 'metric', got '${config.chartType}'`);
        }

        // Call subclass validation
        this.validateMetricWidgetConfig(config);
    }

    // Abstract Methods - Must be implemented by subclasses

    /**
     * Transform raw data to MetricData format
     */
    protected abstract transformDataToMetric(data: any): MetricData;

    /**
     * Subclass-specific metric widget validation
     */
    protected abstract validateMetricWidgetConfig(config: ChartWidgetConfig): void;
}

