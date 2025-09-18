import { Component, OnInit } from '@angular/core';
import { Observable, map, catchError, of } from 'rxjs';
import { CirculationMetricWidgetComponent } from './circulation-metric-widget.component';
import { MetricData } from '../base/metric-widget.component';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';

/**
 * CurrentHoldsMetricWidget - Displays current holds count and status
 *
 * Shows the total number of current holds in the system with status breakdown.
 * Matches the design shown in the metric card screenshot with:
 * - Large numeric value (524)
 * - Clear title (Current Holds)
 * - Status indicator (Pending with bookmark icon)
 */
@Component({
    selector: 'eg-current-holds-metric-widget',
    template: `
        <div class="eg-current-holds-metric-widget">
            <!-- Loading State -->
            <div *ngIf="isLoading" class="card">
                <div class="card-body text-center">
                    <div class="spinner-border text-info" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2 text-muted">Loading holds data...</p>
                </div>
            </div>

            <!-- Error State -->
            <div *ngIf="hasError && !isLoading" class="card border-danger">
                <div class="card-body text-center">
                    <span class="material-icons text-danger mb-2" style="font-size: 2rem;">error</span>
                    <h6 class="card-title text-danger">Error Loading Holds</h6>
                    <p class="card-text">{{ currentError?.message || 'Failed to load current holds data' }}</p>
                    <button class="btn btn-outline-danger btn-sm" (click)="refresh()">
                        <span class="material-icons">refresh</span> Retry
                    </button>
                </div>
            </div>

            <!-- Metric Content -->
            <div *ngIf="!isLoading && !hasError" class="card border-info">
                <div class="card-body text-center">
                    <div class="mb-2">
                        <span class="material-icons text-info" style="font-size: 2rem;">bookmark</span>
                    </div>
                    <h2 class="text-info mb-1">{{ metricData?.value || '524' }}</h2>
                    <h5 class="card-title text-dark mb-2">{{ metricData?.title || 'Current Holds' }}</h5>
                    <div class="d-flex justify-content-center align-items-center">
                        <span class="material-icons text-info me-1" style="font-size: 1rem;">bookmark</span>
                        <span class="text-muted">{{ metricData?.status || 'Pending' }}</span>
                    </div>
                    <div *ngIf="metricData?.trend && metricData?.trendValue" class="mt-2">
                        <small class="text-muted">
                            <span class="material-icons"
                                  [class]="metricData.trend === 'up' ? 'text-success' : metricData.trend === 'down' ? 'text-danger' : 'text-secondary'"
                                  style="font-size: 0.875rem;">
                                {{ metricData.trend === 'up' ? 'trending_up' : metricData.trend === 'down' ? 'trending_down' : 'trending_flat' }}
                            </span>
                            {{ metricData.trendValue }}
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .eg-current-holds-metric-widget {
            width: 100%;
            height: 100%;
        }

        /* Custom styling for holds metric */
        .eg-current-holds-metric-widget .circulation-holds {
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        }

        .eg-current-holds-metric-widget .circulation-holds .circulation-icon {
            color: var(--bs-info, #0dcaf0);
        }

        .eg-current-holds-metric-widget .circulation-holds .circulation-value {
            font-size: 3rem;
            font-weight: 700;
            color: var(--bs-info, #0dcaf0);
        }

        .eg-current-holds-metric-widget .circulation-holds .circulation-title {
            font-size: 1.1rem;
            color: var(--bs-gray-700, #495057);
            margin-top: 0.5rem;
        }

        .eg-current-holds-metric-widget .circulation-status {
            background: var(--bs-info-subtle, #cff4fc);
            color: var(--bs-info-emphasis, #055160);
            border: 1px solid var(--bs-info-border-subtle, #9eeaf9);
        }
    `]
})
export class CurrentHoldsMetricWidget extends CirculationMetricWidgetComponent implements OnInit {

    ngOnInit(): void {
        this.setupWidget();
        this.loadData();
    }

    /**
     * Load current holds data
     */
    protected loadData(): void {
        this.loading$.next(true);

        this.fetchCurrentHoldsData().subscribe({
            next: (metricData) => {
                this.metricData = metricData;
                this.loading$.next(false);
            },
            error: (error) => {
                console.error('Error loading current holds data:', error);
                this.error$.next(error);
                this.loading$.next(false);
            }
        });
    }

    /**
     * Fetch current holds data from circulation services
     */
    private fetchCurrentHoldsData(): Observable<MetricData> {
        const query = this.buildBaseCirculationQuery();

        // In a real implementation, this would call the actual OpenSRF service
        // For now, we'll use mock data that matches the screenshot
        return this.getMockHoldsData().pipe(
            map(holdsData => this.transformHoldsDataToMetric(holdsData)),
            catchError(error => {
                console.error('Failed to fetch holds data:', error);
                throw error;
            })
        );
    }

    /**
     * Mock data service (replace with actual OpenSRF calls)
     */
    private getMockHoldsData(): Observable<any> {
        // Mock data matching the screenshot design
        const mockData = {
            totalHolds: 524,
            pendingHolds: 387,
            readyHolds: 98,
            transitHolds: 39,
            previousPeriodTotal: 498
        };

        return of(mockData);
    }

    /**
     * Transform holds data into MetricData format
     */
    private transformHoldsDataToMetric(holdsData: any): MetricData {
        const currentValue = holdsData.totalHolds;
        const previousValue = holdsData.previousPeriodTotal;
        const { trend, trendValue } = this.calculateTrend(currentValue, previousValue);

        return {
            value: currentValue,
            title: 'Current Holds',
            subtitle: this.getHoldsSubtitle(holdsData),
            icon: this.CIRCULATION_ICONS.holds,
            color: this.CIRCULATION_COLORS.holds as 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary',
            status: 'Pending',
            statusIcon: 'bookmark',
            trend: trend,
            trendValue: trendValue
        };
    }

    /**
     * Get subtitle text based on holds breakdown
     */
    private getHoldsSubtitle(holdsData: any): string {
        const pending = holdsData.pendingHolds;
        const ready = holdsData.readyHolds;

        return `${pending} pending, ${ready} ready`;
    }

    /**
     * Get default icon for holds metric
     */
    protected getDefaultIcon(): string {
        return this.CIRCULATION_ICONS.holds;
    }

    /**
     * Get circulation type for styling
     */
    protected getCirculationType(): string {
        return 'holds';
    }

    /**
     * Validate holds metric configuration
     */
    protected validateCirculationMetricConfig(config: ChartWidgetConfig): void {
        if (!config.metricOptions) {
            config.metricOptions = {};
        }

        // Set default configuration for holds metric
        if (!config.metricOptions.icon) {
            config.metricOptions.icon = this.getDefaultIcon();
        }

        if (!config.metricOptions.showStatus) {
            config.metricOptions.showStatus = true;
        }

        if (!config.metricOptions.showTrend) {
            config.metricOptions.showTrend = true;
        }
    }

    /**
     * Get widget display name
     */
    public getDisplayName(): string {
        return 'Current Holds';
    }

    /**
     * Get widget description
     */
    public getDescription(): string {
        return 'Displays the current number of holds in the system with status breakdown';
    }

    /**
     * Check if widget supports time range filtering
     */
    public supportsTimeRange(): boolean {
        return true;
    }

    /**
     * Check if widget supports organizational unit filtering
     */
    public supportsOrgUnitFilter(): boolean {
        return true;
    }

    /**
     * Implementation of abstract fetchData method from BaseWidgetComponent
     */
    protected fetchData(config: ChartWidgetConfig): Observable<any> {
        return this.getMockHoldsData();
    }

    /**
     * Implementation of abstract transformDataToMetric method from MetricWidgetComponent
     */
    protected transformDataToMetric(data: any): MetricData {
        return this.transformHoldsDataToMetric(data);
    }
}