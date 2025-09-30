import { Component, OnInit, OnDestroy } from '@angular/core';
import { DashboardService } from '../dashboard.service';
import { CirculationDashboardData } from '../interfaces';
import { ChartData, ChartConfiguration } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { ChartWidgetConfig } from '../interfaces/dashboard.interfaces';
import { WidgetJsonConfig } from '../interfaces/widget-json-config.interface';

@Component({
    selector: 'eg-dashboard-display',
    templateUrl: './display.component.html',
    styleUrls: ['./display.component.css']
})
export class DashboardDisplayComponent implements OnInit, OnDestroy {

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

    // Widget configurations
    monthlyCirculationWidget: ChartWidgetConfig | null = null;
    currentHoldsMetricWidget: ChartWidgetConfig | null = null;
    showWidgetSection = true;

    // JSON-driven widget configurations
    jsonChartWidget: WidgetJsonConfig | null = null;
    jsonMetricWidget: WidgetJsonConfig | null = null;
    showJsonWidgetSection = true;

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

    constructor(private dashboardService: DashboardService) {}

    ngOnInit(): void {
        this.loadDashboardData();
    }

    ngOnDestroy(): void {
        // Cleanup handled by Angular's automatic unsubscription
    }

    async loadDashboardData(): Promise<void> {
        try {
            this.loading = true;
            this.error = null;

            // Load data in parallel for better performance
            const [dashboardData, circulationData] = await Promise.all([
                this.dashboardService.getDashboardData(),
                this.dashboardService.getCirculationDashboardData()
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

        // Initialize widgets
        this.initializeWidgets();
    }

    /**
     * Initialize dashboard widgets
     */
    private initializeWidgets(): void {
        try {
            // Create monthly circulation by shelving location widget
            this.monthlyCirculationWidget = this.dashboardService.createCirculationWidget({
                name: 'Monthly Circulation by Shelving Location',
                title: 'Monthly Circulation by Shelving Location',
                timeRange: 'month'
            });

            // Create current holds metric widget
            this.currentHoldsMetricWidget = this.dashboardService.createMetricWidget({
                name: 'Current Holds',
                title: 'Current Holds',
                timeRange: 'today'
            });

            // Initialize JSON-driven widgets
            this.initializeJsonWidgets();
        } catch (error) {
            console.error('Error initializing widgets:', error);
        }
    }

    /**
     * Initialize JSON-driven widgets
     */
    private initializeJsonWidgets(): void {
        // JSON Chart Widget - Circulation by Shelving Location
        this.jsonChartWidget = {
            id: 'json-circulation-by-location',
            name: 'Circulation by Location (JSON)',
            type: 'chart',
            description: 'JSON-driven bar chart showing circulation by shelving location',
            category: 'circulations',

            dataSource: {
                service: 'circulation',
                method: 'getCirculationByShelvingLocation',
                params: {
                    timeRange: 'month'
                },
                cache: {
                    enabled: true,
                    ttl: 300
                }
            },

            transform: {
                type: 'groupBy',
                xField: 'shelving_location_name',
                yField: 'checkouts',
                groupByField: 'shelving_location',
                aggregation: 'sum',
                sortBy: {
                    field: 'checkouts',
                    order: 'desc'
                },
                limit: 10
            },

            visualization: {
                chartType: 'bar',
                title: 'Top 10 Locations by Circulation',
                subtitle: 'Last 30 days',
                xAxisLabel: 'Shelving Location',
                yAxisLabel: 'Number of Checkouts',
                colors: ['#0d6efd', '#6610f2', '#6f42c1'],
                showLegend: false,
                showGrid: true,
                showTooltip: true,
                animated: true
            },

            timeRange: {
                type: 'month'
            },

            autoRefresh: {
                enabled: false,
                interval: 300
            },

            metadata: {
                author: 'System',
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                version: '1.0.0',
                tags: ['circulation', 'json-widget', 'example']
            }
        };

        // JSON Metric Widget - Total Circulation Count
        this.jsonMetricWidget = {
            id: 'json-total-circulation',
            name: 'Total Circulation (JSON)',
            type: 'metric',
            description: 'JSON-driven metric showing total circulation count',
            category: 'circulations',

            dataSource: {
                service: 'circulation',
                method: 'getCirculationSummary',
                params: {
                    timeRange: 'month'
                },
                cache: {
                    enabled: true,
                    ttl: 60
                }
            },

            transform: {
                type: 'sum',
                yField: 'total_checkouts',
                aggregation: 'sum'
            },

            visualization: {
                chartType: 'metric',
                title: 'Total Checkouts',
                subtitle: 'Last 30 days',
                icon: 'local_library',
                color: 'success',
                showLegend: false,
                showGrid: false,
                showTooltip: false,
                metricOptions: {
                    format: 'number',
                    precision: 0,
                    showTrend: false,
                    showStatus: false,
                    showTopIcon: true
                }
            },

            timeRange: {
                type: 'month'
            },

            autoRefresh: {
                enabled: true,
                interval: 300
            },

            metadata: {
                author: 'System',
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                version: '1.0.0',
                tags: ['circulation', 'json-widget', 'metric', 'example']
            }
        };
    }

    refreshData(): void {
        this.loadDashboardData();
    }

    // Unified chart type change handler with localStorage persistence
    onChartTypeChanged(chartId: string, newType: 'line' | 'bar' | 'pie'): void {
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
    onCirculationChartTypeChanged(newType: 'line' | 'bar' | 'pie'): void {
        this.onChartTypeChanged('circulation-trend', newType);
    }

    onCollectionChartTypeChanged(newType: 'line' | 'bar' | 'pie'): void {
        this.onChartTypeChanged('collection-breakdown', newType);
    }

    onPatronActivityChartTypeChanged(newType: 'line' | 'bar' | 'pie'): void {
        this.onChartTypeChanged('patron-activity', newType);
    }

    onLibraryPerformanceChartTypeChanged(newType: 'line' | 'bar' | 'pie'): void {
        this.onChartTypeChanged('library-performance', newType);
    }

    onChartError(error: any): void {
        console.error('Chart error:', error);
        // Could implement user-friendly error notifications here
    }

    // Utility method to get saved chart preferences
    getChartPreference(chartId: string): 'line' | 'bar' | 'pie' | null {
        try {
            const preferences = JSON.parse(localStorage.getItem('dashboard-chart-preferences') || '{}');
            return preferences[chartId] || null;
        } catch (error) {
            console.warn('Failed to get chart preference:', error);
            return null;
        }
    }

    // ========================================================================
    // Widget Event Handlers
    // ========================================================================

    /**
     * Handle widget data loaded event
     */
    onWidgetDataLoaded(data: any): void {
        // Could implement additional processing here
    }

    /**
     * Handle widget errors
     */
    onWidgetError(error: any): void {
        console.error('Widget error:', error);
        // Could implement user-friendly error notifications here
    }

    /**
     * Handle widget configuration changes
     */
    onWidgetConfigChanged(config: ChartWidgetConfig): void {
        console.log('Widget config changed:', config);
        // Update the widget configuration
        if (config.id === this.monthlyCirculationWidget?.id) {
            this.monthlyCirculationWidget = { ...config };
        } else if (config.id === this.currentHoldsMetricWidget?.id) {
            this.currentHoldsMetricWidget = { ...config };
        }
    }

    /**
     * Refresh all widgets
     */
    refreshWidgets(): void {
        console.log('Refreshing all widgets...');
        // Force refresh by updating widget configurations
        if (this.monthlyCirculationWidget) {
            this.monthlyCirculationWidget = {
                ...this.monthlyCirculationWidget,
                lastModified: new Date().toISOString()
            };
        }
        if (this.currentHoldsMetricWidget) {
            this.currentHoldsMetricWidget = {
                ...this.currentHoldsMetricWidget,
                lastModified: new Date().toISOString()
            };
        }
    }

    /**
     * Toggle widget section visibility
     */
    toggleWidgetSection(): void {
        this.showWidgetSection = !this.showWidgetSection;

        // Save preference
        try {
            localStorage.setItem('dashboard-show-widgets', this.showWidgetSection.toString());
        } catch (error) {
            console.warn('Failed to save widget visibility preference:', error);
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
}