import { Component, Input, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { WidgetJsonConfig } from '@eg/staff/dashboard/interfaces/widget-json-config.interface';
import { ChartData, ChartConfiguration } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { WidgetConfigEngine } from '../engines/widget-config.engine';
import { EgChartComponent } from '@eg/share/eg-charts/eg-chart.component';

/**
 * JsonChartWidgetComponent - Renders chart widgets from JSON configuration
 *
 * This component takes a JSON configuration and renders a chart widget.
 * It uses the WidgetConfigEngine to:
 * 1. Fetch data from the configured data source
 * 2. Apply transformations
 * 3. Convert to ChartData format
 * 4. Render with eg-charts
 *
 * Features:
 * - Completely configuration-driven
 * - No custom code required
 * - Supports all chart types (bar, line, pie)
 * - Loading and error states
 * - Auto-refresh support
 * - Export functionality
 */
@Component({
    selector: 'eg-json-chart-widget',
    template: `
        <div class="eg-json-chart-widget" [class.loading]="isLoading" [class.error]="hasError">

            <!-- Widget Header -->
            <div class="widget-header" *ngIf="showHeader">
                <h3 class="widget-title">
                    <span class="material-icons me-2" *ngIf="config?.visualization?.icon" aria-hidden="true">
                        {{ config.visualization.icon }}
                    </span>
                    {{ config?.visualization?.title || config?.name }}
                </h3>
                <div class="widget-actions">
                    <button *ngIf="config?.visualization?.showExportButton !== false"
                            class="btn btn-sm btn-outline-secondary"
                            (click)="exportData()"
                            [disabled]="isLoading || !chartData"
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
            <div *ngIf="isLoading" class="widget-loading">
                <div class="d-flex flex-column justify-content-center align-items-center p-4">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="text-muted mt-2 mb-0 small">Loading data...</p>
                </div>
            </div>

            <!-- Error State -->
            <div *ngIf="hasError && !isLoading" class="widget-error">
                <div class="alert alert-danger m-3">
                    <div class="d-flex align-items-start">
                        <span class="material-icons me-2" style="font-size: 2rem;">error</span>
                        <div class="flex-grow-1">
                            <h5 class="alert-heading">Error Loading Chart</h5>
                            <p class="mb-2">{{ errorMessage || 'Failed to load chart data' }}</p>
                            <button class="btn btn-sm btn-danger" (click)="refresh()">
                                <span class="material-icons">refresh</span> Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Chart Content -->
            <div *ngIf="!isLoading && !hasError && chartData" class="widget-content">
                <eg-chart
                    #chartComponent
                    [chartData]="chartData"
                    [config]="chartConfig"
                    [type]="config?.visualization?.chartType || 'bar'"
                    [showExportButton]="false">
                </eg-chart>
            </div>

            <!-- No Data State -->
            <div *ngIf="!isLoading && !hasError && !chartData" class="widget-no-data">
                <div class="text-center p-4 text-muted">
                    <span class="material-icons mb-3" style="font-size: 3rem;">bar_chart</span>
                    <p>No data available for this chart.</p>
                    <button class="btn btn-sm btn-outline-primary" (click)="refresh()">
                        <span class="material-icons">refresh</span> Refresh Data
                    </button>
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
        .eg-json-chart-widget {
            background: var(--bs-card-bg, #fff);
            border: 1px solid var(--bs-border-color, #dee2e6);
            border-radius: var(--bs-border-radius, 0.375rem);
            box-shadow: var(--bs-box-shadow-sm, 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075));
            transition: all 0.2s ease-in-out;
        }

        .eg-json-chart-widget.loading {
            opacity: 0.8;
        }

        .widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid var(--bs-border-color, #dee2e6);
            background: var(--bs-light, #f8f9fa);
        }

        .widget-title {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--bs-dark, #212529);
            display: flex;
            align-items: center;
        }

        .widget-actions {
            display: flex;
            gap: 0.5rem;
        }

        .widget-content {
            padding: 1rem;
            background: var(--bs-body-bg);
        }

        .widget-loading,
        .widget-error,
        .widget-no-data {
            min-height: 200px;
        }

        .widget-loading {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .spinning {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

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
            max-height: 200px;
            overflow: auto;
        }

        @media (max-width: 768px) {
            .widget-header {
                flex-direction: column;
                gap: 0.75rem;
                align-items: flex-start;
            }

            .widget-actions {
                align-self: flex-end;
            }
        }
    `]
})
export class JsonChartWidgetComponent implements OnInit, OnDestroy {

    @Input() config!: WidgetJsonConfig;
    @Input() showHeader = true;
    @Input() showDebugInfo = false;

    @ViewChild('chartComponent') chartComponent?: EgChartComponent;

    // Component state
    isLoading = false;
    hasError = false;
    errorMessage: string | null = null;
    chartData: ChartData | null = null;

    // Chart configuration
    chartConfig: ChartConfiguration = {
        width: 800,
        height: 400,
        margin: { top: 20, right: 20, bottom: 40, left: 60 },
        showGrid: true,
        showTooltip: true,
        animated: true
    };

    // Services
    private widgetEngine = inject(WidgetConfigEngine);
    private destroy$ = new Subject<void>();

    // Auto-refresh timer
    private refreshTimer?: number;

    ngOnInit(): void {
        this.validateConfig();
        this.configureChart();
        this.loadChartData();
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
            throw new Error('JSON Chart Widget requires a configuration');
        }

        const validation = this.widgetEngine.validateWidgetConfig(this.config);
        if (!validation.valid) {
            console.error('Invalid widget configuration:', validation.errors);
            this.hasError = true;
            this.errorMessage = `Configuration errors: ${validation.errors.join(', ')}`;
        }
    }

    /**
     * Configure chart based on visualization settings
     */
    private configureChart(): void {
        if (!this.config.visualization) return;

        const viz = this.config.visualization;

        // Apply visualization options to chart config
        this.chartConfig = {
            ...this.chartConfig,
            showGrid: viz.showGrid !== false,
            showTooltip: viz.showTooltip !== false,
            animated: viz.animated !== false
        };
    }

    /**
     * Load chart data from configuration
     */
    private loadChartData(): void {
        if (this.hasError) return;

        this.isLoading = true;
        this.hasError = false;
        this.errorMessage = null;

        this.widgetEngine.executeChartWidget(this.config)
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    console.error('Error loading chart data:', error);
                    this.hasError = true;
                    this.errorMessage = error.message || 'Unknown error occurred';
                    this.isLoading = false;
                    throw error;
                })
            )
            .subscribe({
                next: (chartData) => {
                    this.chartData = chartData;
                    this.isLoading = false;
                    console.log('Chart data loaded successfully:', chartData);
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
            console.log(`Auto-refreshing widget: ${this.config.name}`);
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
     * Refresh chart data
     */
    public refresh(): void {
        console.log(`Refreshing chart widget: ${this.config.name}`);
        this.loadChartData();
    }

    /**
     * Export chart data
     */
    public exportData(): void {
        if (this.chartComponent) {
            this.chartComponent.downloadChartData();
        } else if (this.chartData) {
            // Fallback export if chart component not available
            this.exportAsJson();
        }
    }

    /**
     * Export data as JSON
     */
    private exportAsJson(): void {
        if (!this.chartData) return;

        const exportData = {
            widget: this.config.name,
            config: this.config,
            data: this.chartData,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.config.name}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Get debug information
     */
    public getDebugInfo(): string {
        const info = {
            widgetId: this.config?.id,
            widgetName: this.config?.name,
            chartType: this.config?.visualization?.chartType,
            dataSource: {
                service: this.config?.dataSource?.service,
                method: this.config?.dataSource?.method
            },
            transform: {
                type: this.config?.transform?.type,
                xField: this.config?.transform?.xField,
                yField: this.config?.transform?.yField
            },
            state: {
                loading: this.isLoading,
                error: this.hasError,
                hasData: !!this.chartData,
                seriesCount: this.chartData?.series?.length || 0,
                dataPointCount: this.chartData?.series?.[0]?.data?.length || 0
            }
        };

        return JSON.stringify(info, null, 2);
    }
}