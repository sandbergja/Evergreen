import { Component, Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CirculationWidgetComponent } from './circulation-widget.component';
import { ChartData, ChartSeries } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';
import { CirculationDataService, CirculationDataPoint } from '../services/circulation-data.service';

/**
 * MonthlyCirculationByShelvingLocationWidget
 *
 * A concrete implementation of CirculationWidgetComponent that displays
 * monthly circulation statistics grouped by shelving location.
 *
 * Features:
 * - Bar chart visualization of checkouts by shelving location
 * - Filtering by shelving location, material format, and patron type
 * - Monthly time period with configurable date ranges
 * - Export functionality for circulation data
 * - Responsive design with mobile-friendly layout
 */
@Component({
    selector: 'eg-monthly-circulation-by-location-chart-widget',
    template: `
        <div class="eg-circulation-widget">
            <!-- Use the inherited template from CirculationWidgetComponent -->
            <ng-container *ngTemplateOutlet="chartTemplate"></ng-container>

            <!-- Circulation-specific filter panel -->
            <div *ngIf="showFilters" class="eg-widget-filters mt-3">
                <div class="card">
                    <div class="card-header">
                        <h6 class="card-title mb-0">
                            <span class="material-icons">filter_alt</span> Circulation Filters
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <!-- Shelving Location Filter -->
                            <div class="col-md-6" *ngIf="hasFilter('shelving_location')">
                                <label class="form-label">Shelving Location</label>
                                <select class="form-select form-select-sm"
                                        [(ngModel)]="selectedShelvingLocations"
                                        (change)="onFilterChange()"
                                        multiple>
                                    <option *ngFor="let loc of shelvingLocations"
                                            [value]="loc.value">
                                        {{ loc.label }}
                                    </option>
                                </select>
                                <small class="form-text text-muted">
                                    Select one or more shelving locations to filter results
                                </small>
                            </div>

                            <!-- Material Format Filter -->
                            <div class="col-md-6" *ngIf="hasFilter('material_format')">
                                <label class="form-label">Material Format</label>
                                <select class="form-select form-select-sm"
                                        [(ngModel)]="selectedMaterialFormats"
                                        (change)="onFilterChange()"
                                        multiple>
                                    <option *ngFor="let format of materialFormats"
                                            [value]="format.value">
                                        {{ format.label }}
                                    </option>
                                </select>
                                <small class="form-text text-muted">
                                    Filter by material type (books, DVDs, etc.)
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Data summary panel -->
            <div *ngIf="chartData && !isLoading" class="eg-widget-summary mt-3">
                <div class="card">
                    <div class="card-body">
                        <div class="row text-center">
                            <div class="col-md-3">
                                <div class="metric">
                                    <div class="metric-value">{{ totalCheckouts | number }}</div>
                                    <div class="metric-label">Total Checkouts</div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="metric">
                                    <div class="metric-value">{{ topLocation?.name }}</div>
                                    <div class="metric-label">Top Location</div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="metric">
                                    <div class="metric-value">{{ averagePerLocation | number:'1.0-0' }}</div>
                                    <div class="metric-label">Avg per Location</div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="metric">
                                    <div class="metric-value">{{ activeDays }}</div>
                                    <div class="metric-label">Days in Period</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Chart template inherited from parent -->
        <ng-template #chartTemplate>
            <div class="eg-widget-container" [class.loading]="isLoading" [class.error]="hasError">
                <!-- Widget Header -->
                <div class="eg-widget-header" *ngIf="showHeader">
                    <h3 class="eg-widget-title">
                        <span class="material-icons text-primary me-2">bar_chart</span>
                        {{ config?.title || 'Monthly Circulation by Shelving Location' }}
                    </h3>
                    <div class="eg-widget-actions">
                        <button *ngIf="config?.displayOptions?.showExportButton"
                                class="btn btn-sm btn-outline-secondary"
                                (click)="exportChartData()"
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
                        <button *ngIf="supportedFilters.length > 0"
                                class="btn btn-sm btn-outline-secondary"
                                (click)="toggleFilters()"
                                title="Toggle Filters">
                            <span class="material-icons">filter_alt</span>
                        </button>
                    </div>
                </div>

                <!-- Loading State -->
                <div *ngIf="isLoading" class="eg-widget-loading">
                    <div class="d-flex justify-content-center align-items-center p-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">Loading circulation data...</span>
                        </div>
                        <span class="ml-3">Loading circulation data...</span>
                    </div>
                </div>

                <!-- Error State -->
                <div *ngIf="hasError && !isLoading" class="eg-widget-error">
                    <div class="alert alert-danger m-3">
                        <h5><span class="material-icons">warning</span> Error Loading Circulation Data</h5>
                        <p>{{ currentError?.message || 'Failed to load circulation data' }}</p>
                        <button class="btn btn-sm btn-danger" (click)="refresh()">
                            <span class="material-icons">refresh</span> Retry
                        </button>
                    </div>
                </div>

                <!-- Chart Content -->
                <div *ngIf="!isLoading && !hasError && chartData" class="eg-widget-content">
                    <eg-chart
                        #chartComponent
                        [chartData]="chartData"
                        [config]="chartConfig"
                        [type]="'bar'"
                        (chartError)="onChartError($event)"
                        (dataPointClick)="onDataPointClick($event)">
                    </eg-chart>
                </div>

                <!-- No Data State -->
                <div *ngIf="!isLoading && !hasError && !chartData" class="eg-widget-no-data">
                    <div class="text-center p-4 text-muted">
                        <span class="material-icons" style="font-size: 3rem;">bar_chart</span>
                        <p>No circulation data available for the selected time period and filters.</p>
                        <button class="btn btn-sm btn-outline-primary" (click)="refresh()">
                            <span class="material-icons">refresh</span> Refresh Data
                        </button>
                    </div>
                </div>
            </div>
        </ng-template>
    `,
    styles: [`
        .eg-widget-summary .metric {
            padding: 1rem 0;
        }

        .eg-widget-summary .metric-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--primary);
        }

        .eg-widget-summary .metric-label {
            font-size: 0.875rem;
            color: var(--bs-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .form-select[multiple] {
            min-height: 120px;
        }

        .form-text {
            margin-top: 0.25rem;
        }

        .spinning {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
            .eg-widget-summary .col-md-3 {
                margin-bottom: 1rem;
            }
        }
    `]
})
export class MonthlyCirculationByShelvingLocationWidget extends CirculationWidgetComponent {

    private circulationDataService = inject(CirculationDataService);

    // Summary metrics
    totalCheckouts = 0;
    topLocation: { name: string, checkouts: number } | null = null;
    averagePerLocation = 0;
    activeDays = 0;

    /**
     * Fetch circulation data for the widget
     */
    protected fetchData(config: ChartWidgetConfig): Observable<CirculationDataPoint[]> {
        const query = this.buildBaseCirculationQuery();
        const filteredQuery = this.applyCirculationFilters(query);

        return this.circulationDataService.getCirculationByShelvingLocation(filteredQuery);
    }

    /**
     * Transform circulation data to chart format
     */
    protected transformDataToChart(data: CirculationDataPoint[]): ChartData {
        // Calculate summary metrics
        this.calculateSummaryMetrics(data);

        // Create chart series for checkouts
        const checkoutsSeries: ChartSeries = {
            name: 'Checkouts',
            data: data.map(item => ({
                x: item.shelving_location_name,
                y: item.checkouts,
                label: `${item.checkouts} checkouts`
            })),
            color: this.CHART_COLORS[0]
        };

        // Create optional series for renewals if available
        const series: ChartSeries[] = [checkoutsSeries];

        if (data.some(item => item.renewals && item.renewals > 0)) {
            series.push({
                name: 'Renewals',
                data: data.map(item => ({
                    x: item.shelving_location_name,
                    y: item.renewals || 0,
                    label: `${item.renewals || 0} renewals`
                })),
                color: this.CHART_COLORS[1]
            });
        }

        return {
            series: series,
            title: this.config?.title || 'Monthly Circulation by Shelving Location',
            xAxisLabel: 'Shelving Location',
            yAxisLabel: 'Number of Circulations',
            accessibility: {
                description: `Bar chart showing circulation statistics by shelving location for the period ${this.getDateRange().start.toLocaleDateString()} to ${this.getDateRange().end.toLocaleDateString()}`,
                patterns: this.config?.displayOptions?.showPatterns || false
            }
        };
    }

    /**
     * Calculate summary metrics from data
     */
    private calculateSummaryMetrics(data: CirculationDataPoint[]): void {
        this.totalCheckouts = data.reduce((sum, item) => sum + item.checkouts, 0);

        this.topLocation = data.reduce((top, item) => {
            return !top || item.checkouts > top.checkouts
                ? { name: item.shelving_location_name, checkouts: item.checkouts }
                : top;
        }, null as { name: string, checkouts: number } | null);

        this.averagePerLocation = data.length > 0 ? this.totalCheckouts / data.length : 0;

        const { start, end } = this.getDateRange();
        this.activeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    /**
     * Handle data point clicks - show details
     */
    public onDataPointClick(event: any): void {
        super.onDataPointClick(event);

        // Could implement drill-down functionality here
        // For example, show detailed circulation by day for the selected location
        console.log('Shelving location clicked:', event);
    }

    /**
     * Validate circulation-specific configuration
     */
    protected validateCirculationConfig(config: ChartWidgetConfig): void {
        // Ensure this widget only works with bar charts
        if (config.chartType !== 'bar') {
            throw new Error('MonthlyCirculationByShelvingLocationWidget only supports bar charts');
        }

        // Validate time range is appropriate for monthly data
        if (!['month', 'quarter', 'custom'].includes(config.timeRange)) {
            console.warn('MonthlyCirculationByShelvingLocationWidget works best with month, quarter, or custom time ranges');
        }
    }

    /**
     * Get widget type identifier
     */
    public getWidgetType(): string {
        return 'monthly-circulation-by-shelving-location';
    }

    /**
     * Get default configuration for this widget type
     */
    public static getDefaultConfig(): Partial<ChartWidgetConfig> {
        return {
            name: 'Monthly Circulation by Shelving Location',
            title: 'Monthly Circulation by Shelving Location',
            widgetType: 'circulations',
            chartType: 'bar',
            timeRange: 'month',
            colorTheme: 'evergreen',
            displayOptions: {
                showLegend: true,
                showGrid: true,
                showExportButton: true,
                showPatterns: false
            },
            filters: [
                {
                    filterId: 'shelving_location',
                    label: 'Shelving Location',
                    values: [],
                    selectedValues: []
                },
                {
                    filterId: 'material_format',
                    label: 'Material Format',
                    values: [],
                    selectedValues: []
                }
            ]
        };
    }
}

