import { Component, Input, OnInit, OnDestroy, ViewChild, inject, ElementRef } from '@angular/core';
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
    templateUrl: './json-chart-widget.component.html',
    styleUrl: './json-chart-widget.component.css'
})
export class JsonChartWidgetComponent implements OnInit, OnDestroy {

    @Input() config!: WidgetJsonConfig;
    @Input() showHeader = true;
    @Input() showDebugInfo = false;

    @ViewChild('chartComponent') chartComponent?: EgChartComponent;
    @ViewChild('flipCard') flipCard: ElementRef;

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
     * Get chart data without title (to prevent duplicate titles in header and chart)
     */
    public get chartDataWithoutTitle(): ChartData | null {
        if (!this.chartData) return null;

        return {
            ...this.chartData,
            title: undefined  // Remove title so eg-chart doesn't render it
        };
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

    private showConfig(): void {
        this.flipCard.nativeElement.classList.add('flipped');
    }

    private hideConfig(): void {
        this.flipCard.nativeElement.classList.remove('flipped');

        // And then the actual saving logic goes here
        // Or maybe just passing the event from another component
    }
}