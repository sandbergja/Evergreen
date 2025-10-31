import {Injectable} from '@angular/core';
import {Observable, lastValueFrom} from 'rxjs';
import {toArray} from 'rxjs/operators';
import {NetService} from '@eg/core/net.service';
import {AuthService} from '@eg/core/auth.service';
import {OrgService} from '@eg/core/org.service';
import {
    FilterOption,
    AppliedFilter,
    WidgetTypeFilters,
    FilterValue
} from './interfaces';
import {WidgetJsonConfig} from './interfaces/widget-json-config.interface';
import {CirculationDataService} from '@eg/share/widgets/services/circulation-data.service';

@Injectable({
    providedIn: 'root'
})
export class DashboardService {

    constructor(
        private net: NetService,
        private auth: AuthService,
        private org: OrgService,
        private circulationDataService: CirculationDataService
    ) {
    }

    // Widget-specific filter configurations
    private readonly WIDGET_FILTERS: WidgetTypeFilters = {
        circulations: [
            {
                id: 'shelving_location',
                label: 'Shelving Location',
                type: 'multiselect',
                options: [
                    {value: 'adult_fiction', label: 'Adult Fiction'},
                    {value: 'adult_nonfiction', label: 'Adult Non-Fiction'},
                    {value: 'young_adult', label: 'Young Adult'},
                    {value: 'children', label: 'Children'},
                    {value: 'reference', label: 'Reference'},
                    {value: 'periodicals', label: 'Periodicals'},
                    {value: 'dvd', label: 'DVD Collection'},
                    {value: 'audiobooks', label: 'Audio Books'}
                ]
            },
            {
                id: 'patron_type',
                label: 'Patron Type',
                type: 'multiselect',
                options: [
                    {value: 'adult', label: 'Adult'},
                    {value: 'senior', label: 'Senior'},
                    {value: 'student', label: 'Student'},
                    {value: 'child', label: 'Child'},
                    {value: 'faculty', label: 'Faculty'},
                    {value: 'staff', label: 'Staff'}
                ]
            },
            {
                id: 'material_format',
                label: 'Material Format',
                type: 'multiselect',
                options: [
                    {value: 'book', label: 'Books'},
                    {value: 'dvd', label: 'DVDs'},
                    {value: 'audio', label: 'Audio Books'},
                    {value: 'electronic', label: 'Electronic'},
                    {value: 'magazine', label: 'Magazines'},
                    {value: 'newspaper', label: 'Newspapers'}
                ]
            },
            {
                id: 'library_branch',
                label: 'Library Branch',
                type: 'multiselect',
                options: [
                    {value: 'main', label: 'Main Library'},
                    {value: 'north', label: 'North Branch'},
                    {value: 'south', label: 'South Branch'},
                    {value: 'east', label: 'East Branch'},
                    {value: 'west', label: 'West Branch'}
                ]
            },
            {
                id: 'age_group',
                label: 'Age Group',
                type: 'multiselect',
                options: [
                    {value: 'adult', label: 'Adult'},
                    {value: 'young_adult', label: 'Young Adult'},
                    {value: 'children', label: 'Children'}
                ]
            }
        ],
        acquisitions: [
            {
                id: 'vendor',
                label: 'Vendor',
                type: 'multiselect',
                options: [
                    {value: 'baker_taylor', label: 'Baker & Taylor'},
                    {value: 'ingram', label: 'Ingram'},
                    {value: 'midwest_tape', label: 'Midwest Tape'},
                    {value: 'amazon', label: 'Amazon'},
                    {value: 'overdrive', label: 'OverDrive'}
                ]
            },
            {
                id: 'fund_budget',
                label: 'Fund/Budget',
                type: 'multiselect',
                options: [
                    {value: 'adult_books', label: 'Adult Books'},
                    {value: 'children_books', label: 'Children Books'},
                    {value: 'audiovisual', label: 'Audiovisual'},
                    {value: 'electronic', label: 'Electronic Resources'},
                    {value: 'periodicals', label: 'Periodicals'}
                ]
            },
            {
                id: 'order_status',
                label: 'Order Status',
                type: 'multiselect',
                options: [
                    {value: 'on_order', label: 'On Order'},
                    {value: 'received', label: 'Received'},
                    {value: 'cancelled', label: 'Cancelled'},
                    {value: 'pending', label: 'Pending'}
                ]
            },
            {
                id: 'price_range',
                label: 'Price Range',
                type: 'numberrange',
                placeholder: 'Min - Max price'
            }
        ],
        cataloging: [
            {
                id: 'record_source',
                label: 'Record Source',
                type: 'multiselect',
                options: [
                    {value: 'oclc', label: 'OCLC'},
                    {value: 'local', label: 'Local Creation'},
                    {value: 'vendor', label: 'Vendor Supplied'},
                    {value: 'import', label: 'Batch Import'}
                ]
            },
            {
                id: 'cataloger',
                label: 'Cataloger',
                type: 'multiselect',
                options: [
                    {value: 'staff1', label: 'Staff Cataloger 1'},
                    {value: 'staff2', label: 'Staff Cataloger 2'},
                    {value: 'volunteer', label: 'Volunteer'},
                    {value: 'system', label: 'System Generated'}
                ]
            },
            {
                id: 'language',
                label: 'Language',
                type: 'multiselect',
                options: [
                    {value: 'eng', label: 'English'},
                    {value: 'spa', label: 'Spanish'},
                    {value: 'fre', label: 'French'},
                    {value: 'ger', label: 'German'},
                    {value: 'other', label: 'Other'}
                ]
            }
        ],
        patrons: [
            {
                id: 'home_library',
                label: 'Home Library',
                type: 'multiselect',
                options: [
                    {value: 'main', label: 'Main Library'},
                    {value: 'north', label: 'North Branch'},
                    {value: 'south', label: 'South Branch'},
                    {value: 'east', label: 'East Branch'},
                    {value: 'west', label: 'West Branch'}
                ]
            },
            {
                id: 'patron_status',
                label: 'Patron Status',
                type: 'multiselect',
                options: [
                    {value: 'active', label: 'Active'},
                    {value: 'inactive', label: 'Inactive'},
                    {value: 'expired', label: 'Expired'},
                    {value: 'barred', label: 'Barred'}
                ]
            },
            {
                id: 'registration_period',
                label: 'Registration Period',
                type: 'daterange',
                placeholder: 'Select date range'
            }
        ],
        holdings: [
            {
                id: 'call_number_range',
                label: 'Call Number Range',
                type: 'text',
                placeholder: 'e.g. 796-799'
            },
            {
                id: 'item_status',
                label: 'Item Status',
                type: 'multiselect',
                options: [
                    {value: 'available', label: 'Available'},
                    {value: 'checked_out', label: 'Checked Out'},
                    {value: 'on_hold', label: 'On Hold'},
                    {value: 'in_transit', label: 'In Transit'},
                    {value: 'missing', label: 'Missing'},
                    {value: 'damaged', label: 'Damaged'}
                ]
            },
            {
                id: 'location',
                label: 'Location',
                type: 'multiselect',
                options: [
                    {value: 'stacks', label: 'General Stacks'},
                    {value: 'reference', label: 'Reference'},
                    {value: 'reserve', label: 'Course Reserve'},
                    {value: 'special', label: 'Special Collections'}
                ]
            }
        ]
    };


    getAvailableFilters(widgetType: string): FilterOption[] {
        return this.WIDGET_FILTERS[widgetType] || [];
    }

    applyFiltersToData(data: any, appliedFilters: AppliedFilter[], widgetType: string): any {
        // This method will be used to filter data based on applied filters
        // For now, we'll just return the original data
        // In production, this would apply the filters to the actual database query or data processing

        if (!appliedFilters || appliedFilters.length === 0) {
            return data;
        }

        // Example filter application logic for circulation data
        if (widgetType === 'circulations' && data.circulation_by_library) {
            let filteredData = {...data};

            appliedFilters.forEach(filter => {
                switch (filter.filterId) {
                    case 'library_branch':
                        // Filter by selected library branches
                        filteredData.circulation_by_library = filteredData.circulation_by_library.filter(
                            (library: any) => filter.values.some(value =>
                                library.shortname.toLowerCase() === value.toString().toLowerCase()
                            )
                        );
                        break;
                    case 'material_format':
                        // Filter circulation by material format
                        if (filteredData.circ_modifier) {
                            filteredData.circ_modifier = filteredData.circ_modifier.filter(
                                (format: any) => filter.values.some(value =>
                                    format.format_code.toLowerCase() === value.toString().toLowerCase()
                                )
                            );
                        }
                        break;
                    case 'age_group':
                        // Filter by age group in circulation_by_aris
                        if (filteredData.circulation_by_aris) {
                            const ageGroupMap: { [key: string]: string } = {
                                'adult': 'adult_total',
                                'young_adult': 'ya_total',
                                'children': 'child_total'
                            };

                            // Reset summary to only include selected age groups
                            const newSummary = {adult_total: 0, ya_total: 0, child_total: 0, grand_total: 0};
                            filter.values.forEach(value => {
                                const key = ageGroupMap[value.toString()];
                                if (key && filteredData.circulation_by_aris.summary[key]) {
                                    newSummary[key] = filteredData.circulation_by_aris.summary[key];
                                }
                            });
                            newSummary.grand_total = newSummary.adult_total + newSummary.ya_total + newSummary.child_total;
                            filteredData.circulation_by_aris.summary = newSummary;
                        }
                        break;
                    // Add more filter cases as needed
                }
            });

            return filteredData;
        }

        // For other widget types, return unfiltered data for now
        return data;
    }

    /**
     * Get dashboard widget configurations for the current user
     *
     * This method fetches the user's dashboard configuration which includes:
     * - Org-level default widgets (if user hasn't customized)
     * - User-specific widget selections (if user has customized)
     *
     * Each widget configuration is a WidgetJsonConfig object that contains:
     * - Widget metadata (id, name, category)
     * - Data source configuration (service, method, params)
     * - Transform configuration (how to process data)
     * - Visualization configuration (how to display)
     *
     * Widgets fetch their own data when rendered using the JSON widget system.
     *
     * @returns Promise<WidgetJsonConfig[]> - Array of widget configurations
     */
    async getDashboardData(): Promise<WidgetJsonConfig[]> {
        try {
            console.log('DashboardService: Fetching dashboard widget configurations');

            // Call the Perl API to get user's widgets
            // This combines org defaults + user preferences
            const response = await lastValueFrom(
                this.net.request(
                    'open-ils.dashboard',
                    'open-ils.dashboard.user.widgets.get',
                    this.auth.token()
                )
            );

            console.log('DashboardService: Received widget configs:', response);

            // Response is array of widget objects with json_config property
            if (Array.isArray(response) && response.length > 0) {
                const widgets = response.map(widget => widget.json_config as WidgetJsonConfig);
                console.log(`DashboardService: Successfully loaded ${widgets.length} widgets`);
                return widgets;
            }

            // Handle empty response
            console.warn('DashboardService: No widgets configured for user');
            return [];

        } catch (error) {
            console.error('DashboardService: Exception in getDashboardData:', error);
            // Return empty array on error so dashboard doesn't break
            return [];
        }
    }

    /**
     * Get all available widget configurations
     * Used for widget management UI to show which widgets can be added
     *
     * @param category Optional category filter
     * @returns Promise<WidgetJsonConfig[]> - Array of available widget configurations
     */
    async getAvailableWidgets(category?: string): Promise<WidgetJsonConfig[]> {
        try {
            const query = category ? {category, enabled: true} : {enabled: true};

            // Use toArray() to collect all streamed results
            const widgets = await lastValueFrom(
                this.net.request(
                    'open-ils.dashboard',
                    'open-ils.dashboard.widgets.list',
                    this.auth.token(),
                    query
                ).pipe(
                    toArray()
                )
            );

            // Extract json_config from each widget
            return widgets.map(widget => widget.json_config as WidgetJsonConfig);

        } catch (error) {
            console.error('DashboardService: Error fetching available widgets:', error);
            return [];
        }
    }

    /**
     * Save user's widget preferences
     *
     * @param widgetCodes Array of widget codes in display order
     * @returns Promise<boolean> - Success status
     */
    async saveUserWidgetPreferences(widgetCodes: string[]): Promise<boolean> {
        try {
            const response = await lastValueFrom(
                this.net.request(
                    'open-ils.dashboard',
                    'open-ils.dashboard.user.widgets.update',
                    this.auth.token(),
                    widgetCodes
                )
            );

            return response && response.success === 1;
        } catch (error) {
            console.error('DashboardService: Error saving widget preferences:', error);
            return false;
        }
    }

    /**
     * Get filter options for widget configuration
     */
    getFilterOptions(widgetType: string, filterId: string): FilterValue[] {
        const filters = this.WIDGET_FILTERS[widgetType];
        if (!filters) return [];

        const filter = filters.find(f => f.id === filterId);
        return filter?.options || [];
    }

}
