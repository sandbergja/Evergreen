import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MetricWidgetComponent, MetricData } from '../base/metric-widget.component';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';
import { PcrudService } from '@eg/core/pcrud.service';
import { NetService } from '@eg/core/net.service';
import { CirculationDataService } from '../services/circulation-data.service';
import { DashboardService } from '@eg/staff/dashboard/dashboard.service';

/**
 * CirculationMetricWidgetComponent - Base Class for Circulation-Related Metric Widgets
 *
 * Extends MetricWidgetComponent to provide circulation-specific functionality.
 * Handles common circulation metric operations, data fetching, and transformations.
 *
 * Features:
 * - Circulation data fetching via OpenSRF services
 * - Common circulation metrics (holds, checkouts, renewals, etc.)
 * - Date range handling for circulation metrics
 * - Integration with Evergreen circulation services
 * - Predefined color schemes for circulation metrics
 */
@Component({
    template: `
        <div class="eg-circulation-metric-widget">
            <!-- Inherit template from MetricWidgetComponent -->
            <ng-container *ngTemplateOutlet="metricTemplate"></ng-container>
        </div>

        <!-- Metric template reference -->
        <ng-template #metricTemplate>
            <div class="eg-metric-widget" [class.loading]="isLoading" [class.error]="hasError">
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
                            <div class="error-message">Error Loading Circulation Metric</div>
                            <div class="error-details">{{ currentError?.message || 'Failed to load circulation data' }}</div>
                            <button class="btn btn-sm btn-outline-danger mt-2" (click)="refresh()">
                                <span class="material-icons">refresh</span> Retry
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Metric Content -->
                <div *ngIf="!isLoading && !hasError && metricData" class="eg-metric-content">
                    <div class="metric-card circulation-metric"
                         [class]="getMetricCardClasses()"
                         [attr.aria-label]="getAriaLabel()">

                        <!-- Top Icon (circulation-specific styling) -->
                        <div class="metric-top-icon circulation-icon" *ngIf="metricData.icon && showTopIcon">
                            <span class="material-icons"
                                  [class]="'text-' + (metricData.color || 'primary')"
                                  aria-hidden="true">
                                {{ metricData.icon }}
                            </span>
                        </div>

                        <!-- Main Value -->
                        <div class="metric-value circulation-value"
                             [class]="'text-' + (metricData.color || 'primary')">
                            {{ formatMetricValue(metricData.value) }}
                        </div>

                        <!-- Title -->
                        <div class="metric-title circulation-title">
                            {{ metricData.title }}
                        </div>

                        <!-- Subtitle (optional) -->
                        <div class="metric-subtitle" *ngIf="metricData.subtitle">
                            {{ metricData.subtitle }}
                        </div>

                        <!-- Status Indicator -->
                        <div class="metric-status circulation-status" *ngIf="metricData.status">
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
                        <div class="metric-trend circulation-trend"
                             *ngIf="metricData.trend && config?.metricOptions?.showTrend">
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

                        <!-- Circulation-specific footer info -->
                        <div class="circulation-footer" *ngIf="showCirculationFooter()">
                            <small class="text-muted">
                                {{ getCirculationFooterText() }}
                            </small>
                        </div>
                    </div>
                </div>

                <!-- No Data State -->
                <div *ngIf="!isLoading && !hasError && !metricData" class="eg-metric-no-data">
                    <div class="metric-card no-data-card">
                        <div class="no-data-content">
                            <span class="material-icons no-data-icon">local_library</span>
                            <div class="no-data-message">No circulation data available</div>
                            <button class="btn btn-sm btn-outline-primary mt-2" (click)="refresh()">
                                <span class="material-icons">refresh</span> Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ng-template>
    `,
    styles: [`
        .eg-circulation-metric-widget {
            /* Circulation-specific widget styles */
        }

        .circulation-metric {
            position: relative;
        }

        .circulation-icon .material-icons {
            font-size: 2.5rem;
        }

        .circulation-value {
            font-weight: 800;
        }

        .circulation-title {
            font-weight: 600;
        }

        .circulation-status {
            background: var(--bs-light, #f8f9fa);
            padding: 0.375rem 0.75rem;
            border-radius: var(--bs-border-radius-sm, 0.25rem);
            margin-top: 0.75rem;
        }

        .circulation-trend {
            font-weight: 500;
        }

        .circulation-footer {
            margin-top: 0.5rem;
            padding-top: 0.5rem;
            border-top: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.125));
        }

        /* Circulation-specific color enhancements */
        .metric-card.circulation-holds {
            border-left: 4px solid var(--bs-info, #0dcaf0);
        }

        .metric-card.circulation-checkouts {
            border-left: 4px solid var(--bs-success, #198754);
        }

        .metric-card.circulation-overdue {
            border-left: 4px solid var(--bs-warning, #ffc107);
        }

        .metric-card.circulation-renewals {
            border-left: 4px solid var(--bs-primary, #0d6efd);
        }

        /* Error states specific to circulation */
        .error-details {
            font-size: 0.75rem;
            margin-top: 0.25rem;
            opacity: 0.8;
        }
    `]
})
export abstract class CirculationMetricWidgetComponent extends MetricWidgetComponent {

    // Circulation-specific dependencies
    protected pcrud = inject(PcrudService);
    protected net = inject(NetService);
    protected circulationDataService = inject(CirculationDataService);
    protected dashboardService = inject(DashboardService);

    // Circulation-specific constants
    protected readonly CIRCULATION_SERVICES = {
        CIRCULATION: 'open-ils.circ',
        REPORTING: 'open-ils.reporting',
        ACTOR: 'open-ils.actor'
    };

    // Predefined color schemes for circulation metrics
    protected readonly CIRCULATION_COLORS = {
        holds: 'info',
        checkouts: 'success',
        overdue: 'warning',
        renewals: 'primary',
        returns: 'secondary',
        patrons: 'info'
    };

    // Predefined icons for circulation metrics
    protected readonly CIRCULATION_ICONS = {
        holds: 'bookmark',
        checkouts: 'local_library',
        overdue: 'schedule',
        renewals: 'autorenew',
        returns: 'keyboard_return',
        patrons: 'people',
        items: 'inventory_2'
    };

    /**
     * Setup circulation metric widget
     */
    protected setupWidget(): void {
        super.setupWidget();
        this.configureCirculationMetric();
    }

    /**
     * Configure circulation-specific metric settings
     */
    private configureCirculationMetric(): void {
        if (!this.config) return;

        // Set default icon if not specified
        if (!this.config.metricOptions?.icon && this.getDefaultIcon()) {
            this.config.metricOptions = {
                ...this.config.metricOptions,
                icon: this.getDefaultIcon()
            };
        }
    }

    /**
     * Get default icon for this metric type (override in subclasses)
     */
    protected getDefaultIcon(): string | undefined {
        return undefined;
    }

    /**
     * Get date range for circulation queries
     */
    protected getDateRange(): { start: Date, end: Date } {
        let end = new Date();
        let start = new Date();

        if (this.config?.timeRange === 'custom' && this.config.customDateRange) {
            start = new Date(this.config.customDateRange.start);
            end = new Date(this.config.customDateRange.end);
        } else {
            switch (this.config?.timeRange) {
                case 'today':
                    // Current day from 00:00:00 to 23:59:59
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'day':
                    // Last 24 hours from now
                    start.setDate(end.getDate() - 1);
                    break;
                case 'week':
                    start.setDate(end.getDate() - 7);
                    break;
                case 'month':
                    start.setMonth(end.getMonth() - 1);
                    break;
                case 'quarter':
                    start.setMonth(end.getMonth() - 3);
                    break;
                case 'year':
                    start.setFullYear(end.getFullYear() - 1);
                    break;
                default:
                    // For metrics, default to "today" or current period
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
            }
        }

        return { start, end };
    }

    /**
     * Format date for OpenSRF queries
     */
    protected formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Build base circulation query parameters
     */
    protected buildBaseCirculationQuery(): any {
        const { start, end } = this.getDateRange();
        const currentOrgUnit = this.org.get(this.auth.user()?.ws_ou);

        return {
            start_date: this.formatDate(start),
            end_date: this.formatDate(end),
            org_unit: currentOrgUnit?.id || 1,
            include_descendants: true
        };
    }

    /**
     * Calculate trend information from historical data
     */
    protected calculateTrend(currentValue: number, previousValue: number): { trend: 'up' | 'down' | 'stable', trendValue: string } {
        if (previousValue === 0) {
            return { trend: 'stable', trendValue: 'N/A' };
        }

        const percentChange = ((currentValue - previousValue) / previousValue) * 100;
        const absChange = Math.abs(percentChange);

        if (absChange < 5) {
            return { trend: 'stable', trendValue: '±0%' };
        } else if (percentChange > 0) {
            return { trend: 'up', trendValue: `+${absChange.toFixed(1)}%` };
        } else {
            return { trend: 'down', trendValue: `-${absChange.toFixed(1)}%` };
        }
    }

    /**
     * Get metric card classes with circulation-specific styling
     */
    protected getMetricCardClasses(): string {
        const baseClasses = super.getMetricCardClasses();
        const circulationType = this.getCirculationType();

        if (circulationType) {
            return `${baseClasses} circulation-${circulationType}`;
        }

        return baseClasses;
    }

    /**
     * Get circulation type for styling (override in subclasses)
     */
    protected getCirculationType(): string | undefined {
        return undefined;
    }

    /**
     * Show circulation footer info
     */
    protected showCirculationFooter(): boolean {
        return this.config?.metricOptions?.showStatus !== false;
    }

    /**
     * Get circulation footer text
     */
    protected getCirculationFooterText(): string {
        const { start, end } = this.getDateRange();

        if (this.isToday(start) && this.isToday(end)) {
            return 'Today';
        } else if (this.isThisWeek(start)) {
            return 'This week';
        } else if (this.isThisMonth(start)) {
            return 'This month';
        } else {
            return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        }
    }

    /**
     * Helper to check if date is today
     */
    private isToday(date: Date): boolean {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    /**
     * Helper to check if date is in current week
     */
    private isThisWeek(date: Date): boolean {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return date >= weekStart;
    }

    /**
     * Helper to check if date is in current month
     */
    private isThisMonth(date: Date): boolean {
        const today = new Date();
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }

    /**
     * Validate circulation metric configuration
     */
    protected validateMetricWidgetConfig(config: ChartWidgetConfig): void {
        if (config.widgetType !== 'circulations') {
            throw new Error('CirculationMetricWidgetComponent can only be used with circulation widgets');
        }

        // Validate circulation-specific requirements
        this.validateCirculationMetricConfig(config);
    }

    /**
     * Validate circulation-specific metric configuration
     */
    protected abstract validateCirculationMetricConfig(config: ChartWidgetConfig): void;

    /**
     * Get widget type
     */
    public getWidgetType(): string {
        return 'circulations';
    }

    /**
     * Export circulation metric data with additional context
     */
    public exportMetricData(): void {
        if (!this.metricData) return;

        const { start, end } = this.getDateRange();
        const exportData = {
            timestamp: new Date().toISOString(),
            widget: this.config?.name || 'Circulation Metric',
            dateRange: {
                start: start.toISOString(),
                end: end.toISOString(),
                period: this.config?.timeRange || 'today'
            },
            metric: this.metricData,
            orgUnit: this.org.get(this.auth.user()?.ws_ou)?.shortname || 'Unknown'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `circulation-metric-${this.config?.name || 'metric'}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}