import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ChartWidgetComponent } from '../base/chart-widget.component';
import { ChartData } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';
import { PcrudService } from '@eg/core/pcrud.service';
import { NetService } from '@eg/core/net.service';
import { DashboardService } from '@eg/staff/dashboard/dashboard.service';
import { CirculationDataService } from '../services/circulation-data.service';

/**
 * CirculationWidgetComponent - Base Class for Circulation-Related Widgets
 *
 * Extends ChartWidgetComponent to provide circulation-specific functionality.
 * Handles common circulation data operations, filtering, and chart transformations.
 *
 * Features:
 * - Circulation data fetching via OpenSRF services
 * - Common circulation filters (shelving location, patron type, material format)
 * - Date range handling for circulation data
 * - Integration with Evergreen circulation services
 */
@Component({
    template: `
        <div class="eg-circulation-widget">
            <!-- Inherit template from ChartWidgetComponent -->
            <ng-container *ngTemplateOutlet="chartTemplate"></ng-container>

            <!-- Circulation-specific filter panel (optional) -->
            <div *ngIf="showFilters" class="eg-widget-filters mt-3">
                <div class="card">
                    <div class="card-header">
                        <h6 class="card-title mb-0">
                            <span class="material-icons">filter_alt</span> Filters
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <!-- Shelving Location Filter -->
                            <div class="col-md-4" *ngIf="hasFilter('shelving_location')">
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
                            </div>

                            <!-- Material Format Filter -->
                            <div class="col-md-4" *ngIf="hasFilter('material_format')">
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
                            </div>

                            <!-- Patron Type Filter -->
                            <div class="col-md-4" *ngIf="hasFilter('patron_type')">
                                <label class="form-label">Patron Type</label>
                                <select class="form-select form-select-sm"
                                        [(ngModel)]="selectedPatronTypes"
                                        (change)="onFilterChange()"
                                        multiple>
                                    <option *ngFor="let type of patronTypes"
                                            [value]="type.value">
                                        {{ type.label }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Chart template reference -->
        <ng-template #chartTemplate>
            <div class="eg-widget-container" [class.loading]="isLoading" [class.error]="hasError">
                <!-- Widget Header -->
                <div class="eg-widget-header" *ngIf="showHeader">
                    <h3 class="eg-widget-title">
                        <span class="material-icons text-primary me-2">bar_chart</span>
                        {{ config?.title || config?.name }}
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
                    <div class="d-flex flex-column justify-content-center align-items-center p-4">
                        <div class="spinner-border text-primary" role="status"></div>
                        <p class="text-muted mt-2 mb-0 small">Loading data...</p>
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
                        <p>No circulation data available for the selected time period and filters.</p>
                        <button class="btn btn-sm btn-outline-primary" (click)="refresh()">
                            <i class="fas fa-refresh"></i> Refresh Data
                        </button>
                    </div>
                </div>
            </div>
        </ng-template>
    `,
    styles: [`
        .eg-circulation-widget {
            /* Additional circulation-specific styles */
        }

        .eg-widget-filters {
            margin-top: 1rem;
        }

        .eg-widget-filters .card {
            border: 1px solid var(--bs-border-color-translucent);
            background: var(--bs-light);
        }

        .eg-widget-filters .card-header {
            background: var(--bs-white);
            border-bottom: 1px solid var(--bs-border-color-translucent);
        }

        .form-select {
            min-height: 2.5rem;
        }

        .spinning {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `]
})
export abstract class CirculationWidgetComponent extends ChartWidgetComponent {

    // Circulation-specific dependencies
    protected pcrud = inject(PcrudService);
    protected net = inject(NetService);
    protected dashboardService = inject(DashboardService);
    protected circulationDataService = inject(CirculationDataService);

    // Filter state
    protected showFilters = false;
    protected supportedFilters: string[] = [];
    protected selectedShelvingLocations: string[] = [];
    protected selectedMaterialFormats: string[] = [];
    protected selectedPatronTypes: string[] = [];

    // Filter options (loaded from configuration/services)
    protected shelvingLocations: Array<{value: string | number, label: string}> = [];
    protected materialFormats: Array<{value: string | number, label: string}> = [];
    protected patronTypes: Array<{value: string | number, label: string}> = [];

    // Circulation-specific constants
    protected readonly CIRCULATION_SERVICES = {
        CIRCULATION: 'open-ils.circ',
        REPORTING: 'open-ils.reporting',
        ACTOR: 'open-ils.actor'
    };

    /**
     * Setup circulation widget
     */
    protected setupWidget(): void {
        super.setupWidget();
        this.loadFilterOptions();
        this.initializeFilters();
    }

    /**
     * Initialize filters based on widget configuration
     */
    private initializeFilters(): void {
        if (!this.config?.filters) return;

        // Extract supported filter types from config
        this.supportedFilters = this.config.filters.map(f => f.filterId);

        // Initialize selected values from applied filters
        this.config.filters.forEach(filter => {
            switch (filter.filterId) {
                case 'shelving_location':
                    this.selectedShelvingLocations = (filter.selectedValues || []).map(v => String(v));
                    break;
                case 'material_format':
                    this.selectedMaterialFormats = (filter.selectedValues || []).map(v => String(v));
                    break;
                case 'patron_type':
                    this.selectedPatronTypes = (filter.selectedValues || []).map(v => String(v));
                    break;
            }
        });
    }

    /**
     * Load filter options from dashboard service
     */
    private loadFilterOptions(): void {
        // Load shelving locations
        if (this.hasFilter('shelving_location')) {
            this.shelvingLocations = this.dashboardService.getFilterOptions('circulations', 'shelving_location') || [];
        }

        // Load material formats
        if (this.hasFilter('material_format')) {
            this.materialFormats = this.dashboardService.getFilterOptions('circulations', 'material_format') || [];
        }

        // Load patron types
        if (this.hasFilter('patron_type')) {
            this.patronTypes = this.dashboardService.getFilterOptions('circulations', 'patron_type') || [];
        }
    }

    /**
     * Check if a specific filter is supported
     */
    protected hasFilter(filterId: string): boolean {
        return this.supportedFilters.includes(filterId);
    }

    /**
     * Toggle filter panel visibility
     */
    public toggleFilters(): void {
        this.showFilters = !this.showFilters;
    }

    /**
     * Handle filter changes
     */
    public onFilterChange(): void {
        // Update config with new filter values
        if (this.config?.filters) {
            this.config.filters.forEach(filter => {
                switch (filter.filterId) {
                    case 'shelving_location':
                        filter.selectedValues = [...this.selectedShelvingLocations];
                        break;
                    case 'material_format':
                        filter.selectedValues = [...this.selectedMaterialFormats];
                        break;
                    case 'patron_type':
                        filter.selectedValues = [...this.selectedPatronTypes];
                        break;
                }
            });
        }

        // Refresh data with new filters
        this.refresh();
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
                    start.setMonth(end.getMonth() - 1); // Default to month
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
     * Get effective organizational unit for queries
     * Returns config.orgUnit if set, otherwise user's workstation org unit
     */
    protected getEffectiveOrgUnit(): number {
        const orgUnit = this.config?.orgUnit || this.auth.user()?.ws_ou() || 1;
        // Ensure it's a number - ws_ou() may return string
        return typeof orgUnit === 'number' ? orgUnit : parseInt(String(orgUnit), 10) || 1;
    }

    /**
     * Check if descendants should be included in org unit queries
     * Defaults to true unless explicitly set to false in config
     */
    protected shouldIncludeDescendants(): boolean {
        return this.config?.includeDescendants !== false; // Default true
    }

    /**
     * Build base circulation query parameters
     */
    protected buildBaseCirculationQuery(): any {
        const { start, end } = this.getDateRange();

        return {
            start_date: this.formatDate(start),
            end_date: this.formatDate(end),
            org_unit: this.getEffectiveOrgUnit(),
            include_descendants: this.shouldIncludeDescendants()
        };
    }

    /**
     * Apply circulation filters to query
     */
    protected applyCirculationFilters(query: any): any {
        const filteredQuery = { ...query };

        // Apply shelving location filter
        if (this.selectedShelvingLocations.length > 0) {
            filteredQuery.shelving_locations = this.selectedShelvingLocations;
        }

        // Apply material format filter
        if (this.selectedMaterialFormats.length > 0) {
            filteredQuery.material_formats = this.selectedMaterialFormats;
        }

        // Apply patron type filter
        if (this.selectedPatronTypes.length > 0) {
            filteredQuery.patron_types = this.selectedPatronTypes;
        }

        return filteredQuery;
    }

    /**
     * Validate circulation widget configuration
     */
    protected validateChartWidgetConfig(config: ChartWidgetConfig): void {
        if (config.widgetType !== 'circulations') {
            throw new Error('CirculationWidgetComponent can only be used with circulation widgets');
        }

        // Validate circulation-specific requirements
        this.validateCirculationConfig(config);
    }

    /**
     * Validate circulation-specific configuration
     */
    protected abstract validateCirculationConfig(config: ChartWidgetConfig): void;

    /**
     * Get widget type
     */
    public getWidgetType(): string {
        return 'circulations';
    }
}