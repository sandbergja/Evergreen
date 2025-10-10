import { Component, OnInit, OnDestroy } from '@angular/core';
import { DashboardService } from './dashboard.service';
import { CirculationDashboardData } from './interfaces';
import { ChartData, ChartConfiguration } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { PcrudService } from '@eg/core/pcrud.service';
import { NetService } from '@eg/core/net.service';
import {pipe, tap, lastValueFrom, toArray, map, Observable} from 'rxjs';
import { AuthService } from '@eg/core/auth.service';
import { OrgService } from '@eg/core/org.service';
import { ChartBuildInfo, ChartFetcher, EgChartType } from '@eg/share/eg-charts/eg-chart.component';

@Component({
    selector: 'eg-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {

    // Loading states
    loading = true;
    error: string | null = null;

    // Dashboard metrics
    metrics = {
        circulationToday: 0,
        activePatrons: 0,
        overdueItems: 0,
        totalCollection: 0,
        currentHolds: 0
    };

    // Circulation dashboard data
    circulationData: CirculationDashboardData | null = null;

    // Chart data
    circulationTrendData: ChartData | null = null;
    collectionBreakdownData: ChartData | null = null;
    patronActivityData: ChartData | null = null;
    holdStatusData: ChartData | null = null;

    // New circulation chart data
    libraryPerformanceData: ChartData | null = null;
    formatBreakdownData: ChartData | null = null;
    ageGroupAnalysisData: ChartData | null = null;
    performanceMetricsData: ChartData | null = null;


    // REAL ChartData
    circByDayData: ChartData | null = null;
    collectionByStatusData: ChartData | null = null;

    widgetList: any;
    promisesToLoad: Promise<any>[] = null;

    // Centralized chart configuration - responsive and consistent
    private readonly baseChartConfig: ChartConfiguration = {
        width: 400,
        height: 300,
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
        showGrid: true,
        showTooltip: true,
        animated: true
    };

    // Chart configurations using getters for dynamic sizing
    get circulationChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 500, height: 280 };
    }

    get collectionChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 300, height: 300 };
    }

    get patronActivityChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 400, height: 260 };
    }

    get holdStatusChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 400, height: 260 };
    }

    get libraryPerformanceChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 500, height: 280 };
    }

    get formatBreakdownChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 300, height: 300 };
    }

    get ageGroupAnalysisChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 400, height: 260 };
    }

    get performanceMetricsChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 400, height: 260 };
    }

    get circByDayChartConfig(): ChartConfiguration {
        return { ...this.baseChartConfig, width: 400, height: 260 };
    }

    constructor(
        private dashboardService: DashboardService,
        private net: NetService,
        private pcrud: PcrudService,
        private org: OrgService
    ) {}

    ngOnInit(): void {
        this.loadDashboardData();
    }

    ngOnDestroy(): void {
        // Cleanup handled by Angular's automatic unsubscription
    }

    async loadDashboardData(): Promise<void> {

        if (!this.widgetList) {
            await this.org.settings('ui.dashboard.show_widgets').then(resp => {
                this.widgetList = resp['ui.dashboard.show_widgets']?.split(',');
            });
        }
        console.log(this.widgetList);
        try {
            this.loading = true;
            this.error = null;

            // Load data in parallel for better performance
            const [dashboardData, circulationData] = await Promise.all([
                this.dashboardService.getDashboardData(),
                this.dashboardService.getCirculationDashboardData(),
                // this.circByDayPromise,
                // this.collectionByStatusPromise
            ]);

            // Update all data at once to minimize change detection cycles
            this.updateDashboardState(dashboardData, circulationData);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.error = 'Failed to load dashboard data. Please try again.';
        } finally {
            this.loading = false;
        }
    }

    private updateDashboardState(dashboardData: any, circulationData: CirculationDashboardData): void {
        // Update metrics
        this.metrics = dashboardData.metrics;

        // Update circulation data
        this.circulationData = circulationData;

        // Update original chart data
        this.circulationTrendData = dashboardData.charts.circulationTrend;
        this.collectionBreakdownData = dashboardData.charts.collectionBreakdown;
        this.patronActivityData = dashboardData.charts.patronActivity;
        this.holdStatusData = dashboardData.charts.holdStatus;

        // Update circulation chart data
        this.libraryPerformanceData = circulationData.charts.libraryPerformance;
        this.formatBreakdownData = circulationData.charts.formatBreakdown;
        this.ageGroupAnalysisData = circulationData.charts.ageGroupAnalysis;
        this.performanceMetricsData = circulationData.charts.performanceMetrics;
    }

    refreshData(): void {
        this.loadDashboardData();
    }

    // Unified chart type change handler with localStorage persistence
    onChartTypeChanged(chartId: string, newType: EgChartType): void {
        console.log(`${chartId} chart type changed to:`, newType);

        // Save preference to localStorage for user experience
        try {
            const preferences = JSON.parse(localStorage.getItem('dashboard-chart-preferences') || '{}');
            preferences[chartId] = newType;
            localStorage.setItem('dashboard-chart-preferences', JSON.stringify(preferences));
        } catch (error) {
            console.warn('Failed to save chart preference:', error);
        }
    }

    // Individual chart handlers for backward compatibility
    onCirculationChartTypeChanged(newType: EgChartType): void {
        this.onChartTypeChanged('circulation-trend', newType);
    }

    onCollectionChartTypeChanged(newType: EgChartType): void {
        this.onChartTypeChanged('collection-breakdown', newType);
    }

    onPatronActivityChartTypeChanged(newType: EgChartType): void {
        this.onChartTypeChanged('patron-activity', newType);
    }

    onLibraryPerformanceChartTypeChanged(newType: EgChartType): void {
        this.onChartTypeChanged('library-performance', newType);
    }

    onChartError(error: any): void {
        console.error('Chart error:', error);
        // Could implement user-friendly error notifications here
    }

    // Utility method to get saved chart preferences
    getChartPreference(chartId: string): EgChartType | null {
        try {
            const preferences = JSON.parse(localStorage.getItem('dashboard-chart-preferences') || '{}');
            return preferences[chartId] || null;
        } catch (error) {
            console.warn('Failed to get chart preference:', error);
            return null;
        }
    }

    // Method to export dashboard data for reporting
    exportDashboardData(): void {
        if (!this.circulationData) return;

        const exportData = {
            generated: new Date().toISOString(),
            metrics: this.metrics,
            circulationSummary: this.circulationData.circulation_summary,
            libraryPerformance: this.circulationData.circulation_by_library,
            performanceMetrics: this.circulationData.performance_metrics
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    circByDayObservable: Observable<ChartBuildInfo> = this.pcrud.retrieveAll(
        'dashboard_dailycirc', 
        {flesh: 1, flesh_fields: {'dashboard_dailycirc': ['circ_lib']}}, {fleshSelectors: true})
    .pipe(
        toArray(),
        map((response) => {
            const fetchInfo: ChartFetcher = {
                xAxis: {
                    get_name: (idl) => 'date',
                    get_value: (idl) => idl.date()
                },
                yAxis: {
                    get_name: (idl) => 'count',
                    get_value: (idl) => idl.count()
                },
                filters: [{
                    get_value: (idl) => idl.circ_lib().id(),
                    get_name: (idl) => idl.circ_lib().name()
                }],
                chartType: 'pie'
            }

            const circByDayIncompleteData = {
                title: "Circulations Per Day",
                xAxisLabel: "Date",
                yAxisLabel: "Circulations",
                accessibility: {
                    description: "Line Chart Showing Daily Circulation",
                    dataTable: true,
                    patterns: true
                }
            }
            return {
                incompleteChartData: circByDayIncompleteData, 
                fetchInfo: fetchInfo,
                data: response
            }
        })
    );

    collectionByStatusObservable: Observable<ChartBuildInfo> = this.pcrud.retrieveAll(
        'dashboard_itemstatus',
        {flesh: 1, flesh_fields: {'dashboard_itemstatus': ['status', 'circ_lib']}})
    .pipe(
        toArray(),
        map((response) => {
            return {
                data: response,
                fetchInfo: {
                    xAxis: {
                        get_name: (idl) => 'status',
                        get_value: (idl) => idl.status().name()
                    },
                    yAxis: {
                        get_name: (idl) => 'count',
                        get_value: (idl) => idl.count()
                    },
                    chartType: 'pie'
                },
                incompleteChartData: {
                    title: "Collection by Status"
                }
            }
        })
    );

}
