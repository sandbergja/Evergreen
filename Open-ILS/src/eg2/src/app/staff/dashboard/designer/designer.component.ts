import { Component, OnInit, OnDestroy, ViewContainerRef, ViewChild, ComponentRef } from '@angular/core';
import { DashboardService } from '../dashboard.service';
import { FilterOption, AppliedFilter, ChartWidgetConfig } from '../interfaces';
import { ChartData, ChartConfiguration } from '@eg/share/eg-charts/interfaces/chart-data.interface';

@Component({
    selector: 'eg-dashboard-designer',
    templateUrl: './designer.component.html',
    styleUrls: ['./designer.component.css']
})
export class DashboardDesignerComponent implements OnInit {

    // Widget configuration object
    widgetConfig: ChartWidgetConfig;

    // Preview chart data
    previewChartData: ChartData | null = null;
    previewChartConfig: ChartConfiguration = {
        width: 600,
        height: 300,
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
        showGrid: true,
        showTooltip: true,
        animated: true,
        accessibility: {
            description: 'Preview chart for widget configuration',
            dataTable: false,
            patterns: false
        }
    };

    // Legacy properties (for backward compatibility during transition)
    selectedWidgetType = 'circulations';

    // Filter state
    showFilterOptions = false;
    availableFilters: FilterOption[] = [];
    appliedFilters: AppliedFilter[] = [];
    selectedFilterToAdd: FilterOption | null = null;
    currentFilterValues: (string | number)[] = [];
    currentFilterRangeValues: { [key: string]: string | number } = {};

    constructor(private dashboardService: DashboardService) {
        this.initializeWidgetConfig();
    }

    ngOnInit() {
        this.updateAvailableFilters();
        this.generatePreviewChart();
    }

    private initializeWidgetConfig() {
        const now = new Date().toISOString();
        this.widgetConfig = {
            id: this.generateWidgetId(),
            name: 'New Chart Widget',
            widgetType: 'circulations',
            chartType: 'line',
            title: 'Title Here',
            timeRange: 'week',
            colorTheme: 'primary',
            displayOptions: {
                showLegend: true,
                showGrid: true,
                showExportButton: false,
                showPatterns: false
            },
            filters: [],
            createdDate: now,
            lastModified: now,
            createdBy: 'current_user' // TODO: Get from auth service
        };
    }

    private generateWidgetId(): string {
        return 'widget_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Filter management methods
    toggleFilterOptions() {
        this.showFilterOptions = !this.showFilterOptions;
        // Close filter configuration if it's open
        if (this.showFilterOptions && this.selectedFilterToAdd) {
            this.cancelFilterConfig();
        }
    }

    updateAvailableFilters() {
        this.availableFilters = this.dashboardService.getAvailableFilters(this.widgetConfig.widgetType);
        // Update legacy property for backward compatibility
        this.selectedWidgetType = this.widgetConfig.widgetType;
    }

    onWidgetTypeChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        this.widgetConfig.widgetType = target.value as any;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.updateAvailableFilters();
        // Clear applied filters when widget type changes
        this.widgetConfig.filters = [];
        this.appliedFilters = [];
        this.cancelFilterConfig();
        // Close filter options
        this.showFilterOptions = false;
        // Update preview
        this.generatePreviewChart();
    }

    selectFilterToAdd(filterOption: FilterOption) {
        this.selectedFilterToAdd = filterOption;
        this.currentFilterValues = [];
        this.currentFilterRangeValues = {};
        // Close the filter options list when a filter is selected
        this.showFilterOptions = false;
    }

    isFilterApplied(filterId: string): boolean {
        return this.appliedFilters.some(filter => filter.filterId === filterId);
    }

    updateFilterValue(event: Event, value: string | number) {
        const target = event.target as HTMLInputElement;

        if (this.selectedFilterToAdd?.type === 'multiselect') {
            if (target.checked) {
                this.currentFilterValues.push(value);
            } else {
                this.currentFilterValues = this.currentFilterValues.filter(v => v !== value);
            }
        } else if (this.selectedFilterToAdd?.type === 'select' || this.selectedFilterToAdd?.type === 'text') {
            this.currentFilterValues = [value];
        }
    }

    updateFilterRangeValue(key: string, value: string | number) {
        this.currentFilterRangeValues[key] = value;
    }

    isFilterConfigValid(): boolean {
        if (!this.selectedFilterToAdd) return false;

        if (this.selectedFilterToAdd.type === 'multiselect') {
            return this.currentFilterValues.length > 0;
        } else if (this.selectedFilterToAdd.type === 'select' || this.selectedFilterToAdd.type === 'text') {
            return this.currentFilterValues.length > 0 && this.currentFilterValues[0] !== '';
        } else if (this.selectedFilterToAdd.type === 'numberrange') {
            return this.currentFilterRangeValues['min'] !== undefined &&
                   this.currentFilterRangeValues['max'] !== undefined;
        } else if (this.selectedFilterToAdd.type === 'daterange') {
            return this.currentFilterRangeValues['start'] !== undefined &&
                   this.currentFilterRangeValues['end'] !== undefined;
        }

        return false;
    }

    applyFilter() {
        if (!this.selectedFilterToAdd || !this.isFilterConfigValid()) return;

        let filterValues: (string | number)[];
        let filterLabel: string;

        if (this.selectedFilterToAdd.type === 'numberrange') {
            filterValues = [`${this.currentFilterRangeValues['min']}-${this.currentFilterRangeValues['max']}`];
            filterLabel = `${this.currentFilterRangeValues['min']} - ${this.currentFilterRangeValues['max']}`;
        } else if (this.selectedFilterToAdd.type === 'daterange') {
            filterValues = [`${this.currentFilterRangeValues['start']} to ${this.currentFilterRangeValues['end']}`];
            filterLabel = `${this.currentFilterRangeValues['start']} to ${this.currentFilterRangeValues['end']}`;
        } else {
            filterValues = this.currentFilterValues;
            // Get labels for the values
            if (this.selectedFilterToAdd.options) {
                const labels = filterValues.map(value => {
                    const option = this.selectedFilterToAdd!.options!.find(opt => opt.value === value);
                    return option ? option.label : value.toString();
                });
                filterLabel = labels.join(', ');
            } else {
                filterLabel = filterValues.join(', ');
            }
        }

        const appliedFilter: AppliedFilter = {
            filterId: this.selectedFilterToAdd.id,
            values: filterValues,
            label: `${this.selectedFilterToAdd.label}: ${filterLabel}`
        };

        this.appliedFilters.push(appliedFilter);
        // Sync with widget configuration
        this.widgetConfig.filters = [...this.appliedFilters];
        this.widgetConfig.lastModified = new Date().toISOString();
        this.cancelFilterConfig();
    }

    removeFilter(filterId: string) {
        this.appliedFilters = this.appliedFilters.filter(filter => filter.filterId !== filterId);
        // Sync with widget configuration
        this.widgetConfig.filters = [...this.appliedFilters];
        this.widgetConfig.lastModified = new Date().toISOString();
    }

    cancelFilterConfig() {
        this.selectedFilterToAdd = null;
        this.currentFilterValues = [];
        this.currentFilterRangeValues = {};
    }

    // Widget configuration management methods
    saveWidgetConfig(): void {
        this.widgetConfig.lastModified = new Date().toISOString();
        // TODO: Implement actual save to backend/localStorage
        console.log('Saving widget configuration:', this.widgetConfig);
    }

    exportWidgetConfig(): void {
        const dataStr = JSON.stringify(this.widgetConfig, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `widget_${this.widgetConfig.name.replace(/\s+/g, '_')}_${Date.now()}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    loadWidgetConfig(config: ChartWidgetConfig): void {
        this.widgetConfig = { ...config };
        this.appliedFilters = [...config.filters];
        this.updateAvailableFilters();
    }

    isWidgetConfigValid(): boolean {
        return !!(this.widgetConfig.widgetType &&
                 this.widgetConfig.chartType &&
                 this.widgetConfig.title.trim());
    }

    updateWidgetTitle(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.widgetConfig.title = target.value;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    updateChartType(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.widgetConfig.chartType = target.value as any;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    updateTimeRange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.widgetConfig.timeRange = target.value as any;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    updateColorTheme(event: Event): void {
        const target = event.target as HTMLSelectElement;
        this.widgetConfig.colorTheme = target.value;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    updateShowLegend(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.widgetConfig.displayOptions.showLegend = target.checked;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    updateShowGrid(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.widgetConfig.displayOptions.showGrid = target.checked;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    updateShowExportButton(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.widgetConfig.displayOptions.showExportButton = target.checked;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    updateShowPatterns(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.widgetConfig.displayOptions.showPatterns = target.checked;
        this.widgetConfig.lastModified = new Date().toISOString();
        this.generatePreviewChart();
    }

    // Preview chart generation methods
    generatePreviewChart(): void {
        this.previewChartData = this.createPreviewChartData();
        this.updatePreviewChartConfig();
    }

    private createPreviewChartData(): ChartData {
        const sampleData = this.getWidgetTypeSampleData();
        const colors = this.getPreviewColors();

        return {
            title: this.widgetConfig.title,
            xAxisLabel: this.getXAxisLabel(),
            yAxisLabel: this.getYAxisLabel(),
            series: [{
                name: this.getSeriesName(),
                data: sampleData,
                color: colors.primary
            }],
            accessibility: {
                description: `Preview ${this.widgetConfig.chartType} chart for ${this.widgetConfig.widgetType} data`,
                dataTable: false,
                patterns: true
            }
        };
    }

    private getWidgetTypeSampleData(): any[] {
        const timeLabels = this.getTimeLabels();

        switch (this.widgetConfig.widgetType) {
            case 'circulations':
                return this.generateCirculationData(timeLabels);
            case 'acquisitions':
                return this.generateAcquisitionData(timeLabels);
            case 'cataloging':
                return this.generateCatalogingData(timeLabels);
            case 'patrons':
                return this.generatePatronData(timeLabels);
            case 'holdings':
                return this.generateHoldingsData(timeLabels);
            default:
                return this.generateCirculationData(timeLabels);
        }
    }

    private getTimeLabels(): string[] {
        switch (this.widgetConfig.timeRange) {
            case 'week':
                return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            case 'month':
                return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            case 'quarter':
                return ['Jan', 'Feb', 'Mar'];
            case 'year':
                return ['Q1', 'Q2', 'Q3', 'Q4'];
            default:
                return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        }
    }

    private generateCirculationData(labels: string[]): any[] {
        if (this.widgetConfig.chartType === 'pie') {
            return [
                { x: 'Books', y: 450 },
                { x: 'DVDs', y: 230 },
                { x: 'Audio', y: 180 },
                { x: 'eBooks', y: 140 }
            ];
        }

        return labels.map((label, index) => ({
            x: index,
            y: Math.floor(Math.random() * 100) + 50,
            label: label  // Keep label for tooltips/legends
        }));
    }

    private generateAcquisitionData(labels: string[]): any[] {
        if (this.widgetConfig.chartType === 'pie') {
            return [
                { x: 'Baker & Taylor', y: 340 },
                { x: 'Ingram', y: 280 },
                { x: 'Amazon', y: 160 },
                { x: 'Other', y: 120 }
            ];
        }

        return labels.map((label, index) => ({
            x: index,
            y: Math.floor(Math.random() * 80) + 20,
            label: label
        }));
    }

    private generateCatalogingData(labels: string[]): any[] {
        if (this.widgetConfig.chartType === 'pie') {
            return [
                { x: 'OCLC', y: 520 },
                { x: 'Local', y: 180 },
                { x: 'Vendor', y: 140 },
                { x: 'Import', y: 90 }
            ];
        }

        return labels.map((label, index) => ({
            x: index,
            y: Math.floor(Math.random() * 60) + 30,
            label: label
        }));
    }

    private generatePatronData(labels: string[]): any[] {
        if (this.widgetConfig.chartType === 'pie') {
            return [
                { x: 'Active', y: 2800 },
                { x: 'Inactive', y: 420 },
                { x: 'Expired', y: 280 },
                { x: 'Barred', y: 90 }
            ];
        }

        return labels.map((label, index) => ({
            x: index,
            y: Math.floor(Math.random() * 40) + 10,
            label: label
        }));
    }

    private generateHoldingsData(labels: string[]): any[] {
        if (this.widgetConfig.chartType === 'pie') {
            return [
                { x: 'Available', y: 15600 },
                { x: 'Checked Out', y: 4200 },
                { x: 'On Hold', y: 850 },
                { x: 'In Transit', y: 320 }
            ];
        }

        return labels.map((label, index) => ({
            x: index,
            y: Math.floor(Math.random() * 200) + 100,
            label: label
        }));
    }

    private getPreviewColors(): { primary: string; secondary: string } {
        const colorMap: { [key: string]: { primary: string; secondary: string } } = {
            'primary': { primary: '#0d6efd', secondary: '#6ea8fe' },
            'success': { primary: '#198754', secondary: '#75b798' },
            'danger': { primary: '#dc3545', secondary: '#ea868f' },
            'warning': { primary: '#ffc107', secondary: '#ffda6a' },
            'info': { primary: '#0dcaf0', secondary: '#6edff6' },
            'secondary': { primary: '#6c757d', secondary: '#adb5bd' },
            'dark': { primary: '#212529', secondary: '#495057' }
        };

        return colorMap[this.widgetConfig.colorTheme] || colorMap['primary'];
    }

    private getXAxisLabel(): string {
        if (this.widgetConfig.chartType === 'pie') return '';

        switch (this.widgetConfig.timeRange) {
            case 'week': return 'Day of Week';
            case 'month': return 'Week';
            case 'quarter': return 'Month';
            case 'year': return 'Quarter';
            default: return 'Time Period';
        }
    }

    private getYAxisLabel(): string {
        if (this.widgetConfig.chartType === 'pie') return '';

        switch (this.widgetConfig.widgetType) {
            case 'circulations': return 'Items Circulated';
            case 'acquisitions': return 'Orders Processed';
            case 'cataloging': return 'Records Created';
            case 'patrons': return 'New Registrations';
            case 'holdings': return 'Items Added';
            default: return 'Count';
        }
    }

    private getSeriesName(): string {
        switch (this.widgetConfig.widgetType) {
            case 'circulations': return 'Circulation Data';
            case 'acquisitions': return 'Acquisition Data';
            case 'cataloging': return 'Cataloging Data';
            case 'patrons': return 'Patron Data';
            case 'holdings': return 'Holdings Data';
            default: return 'Data';
        }
    }

    private updatePreviewChartConfig(): void {
        this.previewChartConfig = {
            width: 600,
            height: 300,
            margin: { top: 20, right: 20, bottom: 40, left: 40 },
            showGrid: this.widgetConfig.displayOptions.showGrid,
            showTooltip: true,
            animated: true,
            accessibility: {
                description: `Preview ${this.widgetConfig.chartType} chart for ${this.widgetConfig.widgetType} data`,
                dataTable: false,
                patterns: true
            }
        };
    }

    onPreviewChartError(error: any): void {
        console.error('Preview chart error:', error);
        // Fallback to regenerate chart data
        setTimeout(() => {
            this.generatePreviewChart();
        }, 1000);
    }

}
