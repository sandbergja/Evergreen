import { Component, OnInit, OnDestroy, ViewContainerRef, ViewChild, ComponentRef } from '@angular/core';
import { DashboardService, FilterOption, AppliedFilter } from '../dashboard.service';

@Component({
    selector: 'eg-dashboard-designer',
    templateUrl: './designer.component.html',
    styleUrls: ['./designer.component.css']
})
export class DashboardDesignerComponent implements OnInit {

    // Widget configuration
    selectedWidgetType: string = 'circulations';

    // Filter state
    showFilterOptions: boolean = false;
    availableFilters: FilterOption[] = [];
    appliedFilters: AppliedFilter[] = [];
    selectedFilterToAdd: FilterOption | null = null;
    currentFilterValues: (string | number)[] = [];
    currentFilterRangeValues: { [key: string]: string | number } = {};

    constructor(private dashboardService: DashboardService) {}

    ngOnInit() {
        this.updateAvailableFilters();
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
        this.availableFilters = this.dashboardService.getAvailableFilters(this.selectedWidgetType);
    }

    onWidgetTypeChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        this.selectedWidgetType = target.value;
        this.updateAvailableFilters();
        // Clear applied filters when widget type changes
        this.appliedFilters = [];
        this.cancelFilterConfig();
        // Close filter options
        this.showFilterOptions = false;
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
        this.cancelFilterConfig();
    }

    removeFilter(filterId: string) {
        this.appliedFilters = this.appliedFilters.filter(filter => filter.filterId !== filterId);
    }

    cancelFilterConfig() {
        this.selectedFilterToAdd = null;
        this.currentFilterValues = [];
        this.currentFilterRangeValues = {};
    }

}
