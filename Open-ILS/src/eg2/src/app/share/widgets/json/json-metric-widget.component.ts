import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { WidgetJsonConfig } from '@eg/staff/dashboard/interfaces/widget-json-config.interface';
import { MetricData } from '../base/metric-widget.component';
import { WidgetConfigEngine } from '../engines/widget-config.engine';

/**
 * JsonMetricWidgetComponent - Renders metric widgets from JSON configuration
 *
 * This component takes a JSON configuration and renders a metric widget.
 * It uses the WidgetConfigEngine to:
 * 1. Fetch data from the configured data source
 * 2. Apply transformations (typically aggregations)
 * 3. Convert to MetricData format
 * 4. Render as a metric card
 *
 * Features:
 * - Completely configuration-driven
 * - No custom code required
 * - Supports icons, colors, trends
 * - Loading and error states
 * - Auto-refresh support
 * - Export functionality
 */
@Component({
    selector: 'eg-json-metric-widget',
    template: `
        <div class="eg-json-metric-widget" [class.loading]="isLoading" [class.error]="hasError">

            <!-- Widget Header (optional) -->
            <div class="widget-header" *ngIf="showHeader">
                <h5 class="widget-title">
                    <span class="material-icons me-2" *ngIf="config?.visualization?.icon" aria-hidden="true">
                        {{ config.visualization.icon }}
                    </span>
                    {{ config?.visualization?.title || config?.name }}
                </h5>
                <div class="widget-actions">
                    <button class="btn btn-sm btn-outline-secondary"
                            (click)="refresh()"
                            [disabled]="isLoading"
                            title="Refresh">
                        <span class="material-icons" [class.spinning]="isLoading">refresh</span>
                    </button>
                </div>
            </div>

            <!-- Loading State -->
            <div *ngIf="isLoading" class="metric-loading">
                <div class="metric-card loading-card">
                    <div class="metric-skeleton">
                        <div class="skeleton-icon"></div>
                        <div class="skeleton-value"></div>
                        <div class="skeleton-title"></div>
                    </div>
                </div>
            </div>

            <!-- Error State -->
            <div *ngIf="hasError && !isLoading" class="metric-error">
                <div class="metric-card error-card">
                    <div class="metric-error-content">
                        <span class="material-icons error-icon">error</span>
                        <div class="error-message">Error Loading Metric</div>
                        <p class="error-details small">{{ errorMessage || 'Failed to load metric data' }}</p>
                        <button class="btn btn-sm btn-outline-danger mt-2" (click)="refresh()">
                            <span class="material-icons">refresh</span> Retry
                        </button>
                    </div>
                </div>
            </div>

            <!-- Metric Content -->
            <div *ngIf="!isLoading && !hasError && metricData" class="metric-content">
                <div class="metric-card"
                     [class]="getMetricCardClasses()"
                     [attr.aria-label]="getAriaLabel()">

                    <!-- Top Icon -->
                    <div class="metric-top-icon" *ngIf="metricData.icon && showTopIcon">
                        <span class="material-icons"
                              [class]="'text-' + (metricData.color || getColorFromConfig())"
                              aria-hidden="true">
                            {{ metricData.icon }}
                        </span>
                    </div>

                    <!-- Main Value -->
                    <div class="metric-value"
                         [class]="'text-' + (metricData.color || getColorFromConfig())">
                        {{ metricData.value }}
                    </div>

                    <!-- Title -->
                    <div class="metric-title">
                        {{ metricData.title }}
                    </div>

                    <!-- Subtitle -->
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
                    <div class="metric-trend"
                         *ngIf="metricData.trend && config?.visualization?.metricOptions?.showTrend">
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
            <div *ngIf="!isLoading && !hasError && !metricData" class="metric-no-data">
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

            <!-- Debug Info (only in development) -->
            <div *ngIf="showDebugInfo && !isLoading" class="widget-debug mt-2">
                <details>
                    <summary class="text-muted small">Debug Info</summary>
                    <pre class="small">{{ getDebugInfo() }}</pre>
                </details>
            </div>
        </div>
    `,
    styles: [`
        .eg-json-metric-widget {
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
            font-size: 2.5rem;
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
            padding: 0.375rem 0.75rem;
            background: var(--bs-light, #f8f9fa);
            border-radius: var(--bs-border-radius-sm, 0.25rem);
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

        .skeleton-icon,
        .skeleton-value,
        .skeleton-title {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: skeleton-loading 1.5s infinite;
            border-radius: 0.25rem;
        }

        .skeleton-icon {
            width: 60px;
            height: 60px;
            border-radius: 50%;
        }

        .skeleton-value {
            width: 100px;
            height: 48px;
        }

        .skeleton-title {
            width: 150px;
            height: 16px;
        }

        @keyframes skeleton-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
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
            margin-bottom: 0.25rem;
        }

        .error-details {
            margin-top: 0.25rem;
            opacity: 0.8;
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

        /* Color Variants */
        .metric-card.variant-primary { border-left: 4px solid var(--bs-primary, #0d6efd); }
        .metric-card.variant-success { border-left: 4px solid var(--bs-success, #198754); }
        .metric-card.variant-warning { border-left: 4px solid var(--bs-warning, #ffc107); }
        .metric-card.variant-danger { border-left: 4px solid var(--bs-danger, #dc3545); }
        .metric-card.variant-info { border-left: 4px solid var(--bs-info, #0dcaf0); }
        .metric-card.variant-secondary { border-left: 4px solid var(--bs-secondary, #6c757d); }

        /* Header */
        .widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            margin-bottom: 1rem;
            border-bottom: 1px solid var(--bs-border-color, #dee2e6);
            background: var(--bs-light, #f8f9fa);
            border-radius: var(--bs-border-radius, 0.375rem) var(--bs-border-radius, 0.375rem) 0 0;
        }

        .widget-title {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--bs-dark, #212529);
            display: flex;
            align-items: center;
        }

        .widget-actions {
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

        /* Debug */
        .widget-debug {
            padding: 0.5rem 1rem;
            border-top: 1px solid var(--bs-border-color-translucent);
            background: var(--bs-light, #f8f9fa);
        }

        .widget-debug summary {
            cursor: pointer;
            user-select: none;
        }

        .widget-debug pre {
            margin: 0.5rem 0 0 0;
            padding: 0.5rem;
            background: white;
            border: 1px solid var(--bs-border-color);
            border-radius: 0.25rem;
            max-height: 150px;
            overflow: auto;
        }

        /* Responsive */
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
    `]
})
export class JsonMetricWidgetComponent implements OnInit, OnDestroy {

    @Input() config!: WidgetJsonConfig;
    @Input() showHeader = false;
    @Input() showTopIcon = true;
    @Input() showDebugInfo = false;

    // Component state
    isLoading = false;
    hasError = false;
    errorMessage: string | null = null;
    metricData: MetricData | null = null;

    // Services
    private widgetEngine = inject(WidgetConfigEngine);
    private destroy$ = new Subject<void>();

    // Auto-refresh timer
    private refreshTimer?: number;

    ngOnInit(): void {
        this.validateConfig();
        this.loadMetricData();
        this.setupAutoRefresh();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.clearAutoRefresh();
    }

    /**
     * Validate widget configuration
     */
    private validateConfig(): void {
        if (!this.config) {
            throw new Error('JSON Metric Widget requires a configuration');
        }

        const validation = this.widgetEngine.validateWidgetConfig(this.config);
        if (!validation.valid) {
            console.error('Invalid widget configuration:', validation.errors);
            this.hasError = true;
            this.errorMessage = `Configuration errors: ${validation.errors.join(', ')}`;
        }
    }

    /**
     * Load metric data from configuration
     */
    private loadMetricData(): void {
        if (this.hasError) return;

        this.isLoading = true;
        this.hasError = false;
        this.errorMessage = null;

        this.widgetEngine.executeMetricWidget(this.config)
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Error loading metric data:', error);
                    this.hasError = true;
                    this.errorMessage = error.message || 'Unknown error occurred';
                    this.isLoading = false;
                    throw error;
                })
            )
            .subscribe({
                next: (metricData) => {
                    this.metricData = metricData;
                    this.isLoading = false;
                    console.log('Metric data loaded successfully:', metricData);
                },
                error: (error) => {
                    // Error already handled in catchError
                    this.isLoading = false;
                }
            });
    }

    /**
     * Setup auto-refresh if configured
     */
    private setupAutoRefresh(): void {
        if (!this.config.autoRefresh?.enabled || !this.config.autoRefresh.interval) {
            return;
        }

        const intervalMs = this.config.autoRefresh.interval * 1000;
        this.refreshTimer = window.setInterval(() => {
            console.log(`Auto-refreshing metric widget: ${this.config.name}`);
            this.refresh();
        }, intervalMs);
    }

    /**
     * Clear auto-refresh timer
     */
    private clearAutoRefresh(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    /**
     * Refresh metric data
     */
    public refresh(): void {
        console.log(`Refreshing metric widget: ${this.config.name}`);
        this.loadMetricData();
    }

    /**
     * Get metric card CSS classes
     */
    public getMetricCardClasses(): string {
        const classes = ['metric-card'];

        const color = this.metricData?.color || this.getColorFromConfig();
        if (color) {
            classes.push(`variant-${color}`);
        }

        return classes.join(' ');
    }

    /**
     * Get color from configuration
     */
    public getColorFromConfig(): string {
        return this.config?.visualization?.color || 'primary';
    }

    /**
     * Get aria-label for accessibility
     */
    public getAriaLabel(): string {
        if (!this.metricData) return '';

        let label = `${this.metricData.title}: ${this.metricData.value}`;

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
    public getStatusIconClass(): string {
        const color = this.metricData?.color || this.getColorFromConfig();
        return `text-${color}`;
    }

    /**
     * Get status text CSS class
     */
    public getStatusTextClass(): string {
        const color = this.metricData?.color || this.getColorFromConfig();
        return `text-${color}`;
    }

    /**
     * Get trend icon based on trend direction
     */
    public getTrendIcon(): string {
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
    public getTrendIconClass(): string {
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
    public getTrendTextClass(): string {
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
     * Get debug information
     */
    public getDebugInfo(): string {
        const info = {
            widgetId: this.config?.id,
            widgetName: this.config?.name,
            dataSource: {
                service: this.config?.dataSource?.service,
                method: this.config?.dataSource?.method
            },
            transform: {
                type: this.config?.transform?.type,
                yField: this.config?.transform?.yField,
                aggregation: this.config?.transform?.aggregation
            },
            state: {
                loading: this.isLoading,
                error: this.hasError,
                hasData: !!this.metricData,
                value: this.metricData?.value
            }
        };

        return JSON.stringify(info, null, 2);
    }
}