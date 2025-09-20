import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PcrudService } from '@eg/core/pcrud.service';
import { AuthService } from '@eg/core/auth.service';
import { OrgService } from '@eg/core/org.service';
import { ChartData, ChartSeries, ChartPoint } from '@eg/share/eg-charts/interfaces/chart-data.interface';
import { IdlObject, IdlService } from '@eg/core/idl.service';
import {
    FilterOption,
    AppliedFilter,
    WidgetTypeFilters,
    CirculationDashboardData,
    DashboardData,
    LibraryCirculationData,
    DailyCirculationData,
    CirculationByFormat,
    FilterValue
} from './interfaces';
import { ChartWidgetConfig } from './interfaces/dashboard.interfaces';
import { CirculationDataService } from '@eg/share/widgets/services/circulation-data.service';
import { WidgetFactoryService } from '@eg/share/widgets/factories/widget.factory';
import { WidgetRegistryService } from '@eg/share/widgets/services/widget-registry.service';

export interface chartFetcher {
    xAxis: {
        name: string;
        get: (idl: IdlObject) => any;
    }
    yAxis: {
        name: string;
        get: (idl: IdlObject) => any;
    }
    filters?: chartFilter[];
    chartType?: string;
}

/**
 * Can't figure out how to get the name of what we split our dataset by (for the tooltip),
 * so we make the caller of idlToChartPoints do it. 
 * 
 * Would look something like
 * const filters = [{
 *      get_field_value: (idl) => idl.circ_lib().id(),
 *      get_field_name: (idl) => idl.circ_lib().shortname()
 * }];
 */
export interface chartFilter {
    get_field_value: (idl: IdlObject) => any;
    get_field_name: (idl: IdlObject) => any;
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {

    // Evergreen Chart Color Palette - Vibrant Colors with CSS Override for White Text
    // Using proper dark CSS variables for professional chart appearance
    private readonly EVERGREEN_COLORS = {
        primary: 'var(--primary)',      // Dark blue - Professional chart color
        success: 'var(--success)',      // Dark green - Success/positive metrics
        info: 'var(--info)',           // Dark cyan - Informational data
        warning: 'var(--warning-color)', // Yellow - Warning/attention needed
        danger: 'var(--danger)',        // Dark red - Critical/danger items
        secondary: '#6c757d',           // Medium gray - Accessible secondary
        dark: '#495057'                 // Dark gray - Fallback, not black
    };

    // Order to cycle through colors
    private cycleColors = [
        this.EVERGREEN_COLORS.primary, 
        this.EVERGREEN_COLORS.danger,
        this.EVERGREEN_COLORS.warning,  
        this.EVERGREEN_COLORS.info,  
        this.EVERGREEN_COLORS.success,    
        this.EVERGREEN_COLORS.secondary   
    ];
    private colorIndex: number = 0;

    constructor(
        private pcrud: PcrudService,
        private auth: AuthService,
        private org: OrgService,
        private idl: IdlService,
        private circulationDataService: CirculationDataService,
        private widgetFactory: WidgetFactoryService,
        private widgetRegistry: WidgetRegistryService
    ) {}

    // Widget-specific filter configurations
    private readonly WIDGET_FILTERS: WidgetTypeFilters = {
        circulations: [
            {
                id: 'shelving_location',
                label: 'Shelving Location',
                type: 'multiselect',
                options: [
                    { value: 'adult_fiction', label: 'Adult Fiction' },
                    { value: 'adult_nonfiction', label: 'Adult Non-Fiction' },
                    { value: 'young_adult', label: 'Young Adult' },
                    { value: 'children', label: 'Children' },
                    { value: 'reference', label: 'Reference' },
                    { value: 'periodicals', label: 'Periodicals' },
                    { value: 'dvd', label: 'DVD Collection' },
                    { value: 'audiobooks', label: 'Audio Books' }
                ]
            },
            {
                id: 'patron_type',
                label: 'Patron Type',
                type: 'multiselect',
                options: [
                    { value: 'adult', label: 'Adult' },
                    { value: 'senior', label: 'Senior' },
                    { value: 'student', label: 'Student' },
                    { value: 'child', label: 'Child' },
                    { value: 'faculty', label: 'Faculty' },
                    { value: 'staff', label: 'Staff' }
                ]
            },
            {
                id: 'material_format',
                label: 'Material Format',
                type: 'multiselect',
                options: [
                    { value: 'book', label: 'Books' },
                    { value: 'dvd', label: 'DVDs' },
                    { value: 'audio', label: 'Audio Books' },
                    { value: 'electronic', label: 'Electronic' },
                    { value: 'magazine', label: 'Magazines' },
                    { value: 'newspaper', label: 'Newspapers' }
                ]
            },
            {
                id: 'library_branch',
                label: 'Library Branch',
                type: 'multiselect',
                options: [
                    { value: 'main', label: 'Main Library' },
                    { value: 'north', label: 'North Branch' },
                    { value: 'south', label: 'South Branch' },
                    { value: 'east', label: 'East Branch' },
                    { value: 'west', label: 'West Branch' }
                ]
            },
            {
                id: 'age_group',
                label: 'Age Group',
                type: 'multiselect',
                options: [
                    { value: 'adult', label: 'Adult' },
                    { value: 'young_adult', label: 'Young Adult' },
                    { value: 'children', label: 'Children' }
                ]
            }
        ],
        acquisitions: [
            {
                id: 'vendor',
                label: 'Vendor',
                type: 'multiselect',
                options: [
                    { value: 'baker_taylor', label: 'Baker & Taylor' },
                    { value: 'ingram', label: 'Ingram' },
                    { value: 'midwest_tape', label: 'Midwest Tape' },
                    { value: 'amazon', label: 'Amazon' },
                    { value: 'overdrive', label: 'OverDrive' }
                ]
            },
            {
                id: 'fund_budget',
                label: 'Fund/Budget',
                type: 'multiselect',
                options: [
                    { value: 'adult_books', label: 'Adult Books' },
                    { value: 'children_books', label: 'Children Books' },
                    { value: 'audiovisual', label: 'Audiovisual' },
                    { value: 'electronic', label: 'Electronic Resources' },
                    { value: 'periodicals', label: 'Periodicals' }
                ]
            },
            {
                id: 'order_status',
                label: 'Order Status',
                type: 'multiselect',
                options: [
                    { value: 'on_order', label: 'On Order' },
                    { value: 'received', label: 'Received' },
                    { value: 'cancelled', label: 'Cancelled' },
                    { value: 'pending', label: 'Pending' }
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
                    { value: 'oclc', label: 'OCLC' },
                    { value: 'local', label: 'Local Creation' },
                    { value: 'vendor', label: 'Vendor Supplied' },
                    { value: 'import', label: 'Batch Import' }
                ]
            },
            {
                id: 'cataloger',
                label: 'Cataloger',
                type: 'multiselect',
                options: [
                    { value: 'staff1', label: 'Staff Cataloger 1' },
                    { value: 'staff2', label: 'Staff Cataloger 2' },
                    { value: 'volunteer', label: 'Volunteer' },
                    { value: 'system', label: 'System Generated' }
                ]
            },
            {
                id: 'language',
                label: 'Language',
                type: 'multiselect',
                options: [
                    { value: 'eng', label: 'English' },
                    { value: 'spa', label: 'Spanish' },
                    { value: 'fre', label: 'French' },
                    { value: 'ger', label: 'German' },
                    { value: 'other', label: 'Other' }
                ]
            }
        ],
        patrons: [
            {
                id: 'home_library',
                label: 'Home Library',
                type: 'multiselect',
                options: [
                    { value: 'main', label: 'Main Library' },
                    { value: 'north', label: 'North Branch' },
                    { value: 'south', label: 'South Branch' },
                    { value: 'east', label: 'East Branch' },
                    { value: 'west', label: 'West Branch' }
                ]
            },
            {
                id: 'patron_status',
                label: 'Patron Status',
                type: 'multiselect',
                options: [
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'expired', label: 'Expired' },
                    { value: 'barred', label: 'Barred' }
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
                    { value: 'available', label: 'Available' },
                    { value: 'checked_out', label: 'Checked Out' },
                    { value: 'on_hold', label: 'On Hold' },
                    { value: 'in_transit', label: 'In Transit' },
                    { value: 'missing', label: 'Missing' },
                    { value: 'damaged', label: 'Damaged' }
                ]
            },
            {
                id: 'location',
                label: 'Location',
                type: 'multiselect',
                options: [
                    { value: 'stacks', label: 'General Stacks' },
                    { value: 'reference', label: 'Reference' },
                    { value: 'reserve', label: 'Course Reserve' },
                    { value: 'special', label: 'Special Collections' }
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
            let filteredData = { ...data };

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
                            const newSummary = { adult_total: 0, ya_total: 0, child_total: 0, grand_total: 0 };
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

    async getDashboardData(): Promise<DashboardData> {
        // For now, return sample data
        // In production, this would query the actual Evergreen database
        return this.getSampleData();
    }

    async getCirculationDashboardData(): Promise<CirculationDashboardData> {
        // For now, return sample circulation data based on dashboard-circs.json structure
        // In production, this would query the actual Evergreen database
        return this.generateCirculationSampleData();
    }

    /**
     * TODO: create nested for loop to go through more than one filterField to split the dataset
     * @param idlArr 
     * @param xAxisField 
     * @param yAxisField 
     * @param filterFields 
     * @returns 
     */
    public idlToChartPoints(idlArr: IdlObject[], fetchInfo: chartFetcher) : ChartSeries[] {
        let series = [];

        let foundFilterVals = [];
        if (!fetchInfo.filters) {
            series.push({
                name: 'Hebleh',
                color: this.getNewColor(),
                data: []
            })
        }

        idlArr.forEach(obj => {
            const thisObjFilterValue = fetchInfo.filters?.[0]?.get_field_value(obj);
            const thisObjFilterName = fetchInfo.filters?.[0]?.get_field_name(obj);
            console.log(thisObjFilterValue);
            if (fetchInfo.filters && !foundFilterVals.includes(thisObjFilterValue)) {
                foundFilterVals.push(thisObjFilterValue);
                series.push({
                    name: thisObjFilterName,
                    data: [],
                    color: this.getNewColor()
                });
            }

            let newPoint = {
                x: this.guaranteeIdlDataType(fetchInfo.xAxis , obj), 
                y: this.guaranteeIdlDataType(fetchInfo.yAxis, obj), 
                color: undefined
            };
            if (['pie'].includes(fetchInfo?.chartType)) {
                newPoint.color = this.getNewColor();
            }


            if (fetchInfo.filters) {
                series.find(s => s.name == thisObjFilterName).data.push(newPoint);
            } else {
                series[0].data.push(newPoint);
            }
        });

        return series;
    }

    /**
     * Gotta return a real Date() object for our timestamps, so add this as a guarantee we convert it, if the idlField is a timestamp
     * 
     * @param fieldName 
     * @param obj 
     * @returns 
     */
    private guaranteeIdlDataType(axisInfo: any, obj: IdlObject) {
        const fieldType = this.idl.classes[obj.classname].fields.find(field => field.name === axisInfo.name).datatype;
        if (fieldType === "timestamp") {
            return new Date(axisInfo.get(obj));
        }
        return axisInfo.get(obj);
    }

    private getNewColor(): string {
        const color = this.cycleColors[this.colorIndex % this.cycleColors.length];
        this.colorIndex++;
        return color;
    }

    private getSampleData(): DashboardData {
        // Generate sample data that looks realistic for a library
        const today = new Date();
        const daysBack = 30;

        // Generate circulation trend data (last 30 days)
        const circulationData = [];
        for (let i = daysBack; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            // Create more realistic patterns with weekly cycles
            const baseCount = 150;
            const weeklyPhase = (i % 7) * Math.PI / 3.5; // Weekly cycle
            const weeklyVariation = Math.sin(weeklyPhase) * 30; // ±30 weekly variation
            const randomVariation = (Math.random() - 0.5) * 40; // ±20 random variation

            // Weekend factor (lower circulation on weekends)
            const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.7 : 1;

            // Trend factor (slight increase over time)
            const trendFactor = 1 + (daysBack - i) * 0.002;

            const finalValue = Math.max(20, Math.round(
                (baseCount + weeklyVariation + randomVariation) * weekendFactor * trendFactor
            ));

            circulationData.push({
                x: new Date(date),
                y: finalValue
            });
        }

        // Generate collection breakdown data
        const collectionTypes = [
            { type: 'Books', count: 45000 },
            { type: 'DVDs', count: 8500 },
            { type: 'Audio Books', count: 3200 },
            { type: 'Magazines', count: 1800 },
            { type: 'eBooks', count: 12000 },
            { type: 'Other', count: 2500 }
        ];

        // Generate patron activity data (last 7 days)
        const patronActivityData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            patronActivityData.push({
                x: dayName,
                y: Math.round(Math.random() * 50 + 20) // 20-70 new registrations
            });
        }

        // Generate hold status data
        const holdStatusData = [
            { x: 'Available', y: 156 },
            { x: 'In Transit', y: 89 },
            { x: 'Waiting', y: 234 },
            { x: 'Suspended', y: 45 }
        ];

        return {
            metrics: {
                circulationToday: Math.round(Math.random() * 50 + 120), // 120-170
                activePatrons: Math.round(Math.random() * 100 + 450), // 450-550
                overdueItems: Math.round(Math.random() * 30 + 85), // 85-115
                totalCollection: 73000,
                currentHolds: holdStatusData.reduce((sum, item) => sum + item.y, 0)
            },
            charts: {
                circulationTrend: {
                    title: 'Daily Circulation Trend (Last 30 Days)',
                    xAxisLabel: 'Date',
                    yAxisLabel: 'Items Circulated',
                    series: [{
                        name: 'Circulation',
                        data: circulationData,
                        color: '#0066cc'
                    }],
                    accessibility: {
                        description: 'Line chart showing daily circulation trends over the last 30 days',
                        dataTable: true,
                        patterns: true
                    }
                },
                collectionBreakdown: {
                    title: 'Collection by Material Type',
                    series: [{
                        name: 'Collection',
                        data: collectionTypes.map((item, index) => {
                            const colors = [
                                this.EVERGREEN_COLORS.primary,    // Books - Blue
                                this.EVERGREEN_COLORS.danger,     // DVDs - Red
                                this.EVERGREEN_COLORS.warning,    // Audio Books - Orange
                                this.EVERGREEN_COLORS.info,       // Magazines - Light Blue
                                this.EVERGREEN_COLORS.success,    // eBooks - Green
                                this.EVERGREEN_COLORS.secondary   // Other - Gray
                            ];
                            return {
                                x: item.type,
                                y: item.count,
                                color: colors[index] || this.EVERGREEN_COLORS.dark
                            };
                        })
                    }],
                    accessibility: {
                        description: 'Pie chart showing breakdown of collection by material type',
                        dataTable: true,
                        patterns: true
                    }
                },
                patronActivity: {
                    title: 'New Patron Registrations (Last 7 Days)',
                    xAxisLabel: 'Day',
                    yAxisLabel: 'New Registrations',
                    series: [{
                        name: 'New Registrations',
                        data: patronActivityData,
                        color: '#dc3545'
                    }],
                    accessibility: {
                        description: 'Bar chart showing new patron registrations over the last 7 days',
                        dataTable: true,
                        patterns: true
                    }
                },
                holdStatus: {
                    title: 'Current Hold Request Status',
                    xAxisLabel: 'Status',
                    yAxisLabel: 'Number of Holds',
                    series: [{
                        name: 'Holds',
                        data: holdStatusData,
                        color: '#ffc107'
                    }],
                    accessibility: {
                        description: 'Bar chart showing current hold request status breakdown',
                        dataTable: true,
                        patterns: true
                    }
                }
            }
        };
    }

    private generateCirculationSampleData(): CirculationDashboardData {
        const today = new Date();
        const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Generate library circulation data
        const libraryData: LibraryCirculationData[] = [
            {
                library_name: 'Main Library',
                org_unit_id: 1,
                org_unit_type: 'consortium',
                parent_org_unit_id: null,
                shortname: 'MAIN',
                checkouts: 12456,
                renewals: 1247,
                web_renewals: 653,
                auto_renewals: 5234,
                total: 19590,
                percentage_of_total: 42.8,
                items_per_capita: 8.5,
                service_population: 25000
            },
            {
                library_name: 'North Branch',
                org_unit_id: 2,
                org_unit_type: 'branch',
                parent_org_unit_id: 1,
                shortname: 'NORTH',
                checkouts: 5678,
                renewals: 567,
                web_renewals: 298,
                auto_renewals: 2345,
                total: 8888,
                percentage_of_total: 19.4,
                items_per_capita: 6.2,
                service_population: 12000
            },
            {
                library_name: 'South Branch',
                org_unit_id: 3,
                org_unit_type: 'branch',
                parent_org_unit_id: 1,
                shortname: 'SOUTH',
                checkouts: 4321,
                renewals: 432,
                web_renewals: 234,
                auto_renewals: 1876,
                total: 6863,
                percentage_of_total: 15.0,
                items_per_capita: 5.8,
                service_population: 9500
            },
            {
                library_name: 'East Branch',
                org_unit_id: 4,
                org_unit_type: 'branch',
                parent_org_unit_id: 1,
                shortname: 'EAST',
                checkouts: 3456,
                renewals: 345,
                web_renewals: 187,
                auto_renewals: 1543,
                total: 5531,
                percentage_of_total: 12.1,
                items_per_capita: 7.1,
                service_population: 8000
            },
            {
                library_name: 'West Branch',
                org_unit_id: 5,
                org_unit_type: 'branch',
                parent_org_unit_id: 1,
                shortname: 'WEST',
                checkouts: 2890,
                renewals: 289,
                web_renewals: 156,
                auto_renewals: 1234,
                total: 4569,
                percentage_of_total: 10.0,
                items_per_capita: 6.8,
                service_population: 7500
            }
        ];

        // Generate daily circulation data for the last 30 days
        const dailyCirculation: DailyCirculationData[] = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];

            // Create realistic patterns with weekly cycles
            const baseCheckouts = 1400;
            const weeklyPhase = (i % 7) * Math.PI / 3.5;
            const weeklyVariation = Math.sin(weeklyPhase) * 200;
            const randomVariation = (Math.random() - 0.5) * 150;
            const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.6 : 1;

            const checkouts = Math.max(500, Math.round(
                (baseCheckouts + weeklyVariation + randomVariation) * weekendFactor
            ));

            dailyCirculation.push({
                date: dateString,
                checkouts: checkouts,
                renewals: Math.round(checkouts * 0.15),
                holds_filled: Math.round(checkouts * 0.12)
            });
        }

        // Generate format breakdown data
        const formatData: CirculationByFormat[] = [
            {
                format: 'Book',
                format_code: 'BOOK',
                circulation: 29736,
                percentage_of_total: 64.9,
                trend_indicator: 'stable'
            },
            {
                format: 'DVD',
                format_code: 'DVD',
                circulation: 9165,
                percentage_of_total: 20.0,
                trend_indicator: 'declining'
            },
            {
                format: 'Audio',
                format_code: 'AUDIO',
                circulation: 4582,
                percentage_of_total: 10.0,
                trend_indicator: 'increasing'
            },
            {
                format: 'Electronic',
                format_code: 'ELECTRONIC',
                circulation: 2290,
                percentage_of_total: 5.0,
                trend_indicator: 'increasing'
            }
        ];

        // Calculate totals
        const totalCirculation = libraryData.reduce((sum, lib) => sum + lib.total, 0);
        const circulationSummary = libraryData.reduce((sum, lib) => ({
            checkouts: sum.checkouts + lib.checkouts,
            staff_renewals: sum.staff_renewals + lib.renewals,
            auto_renewals: sum.auto_renewals + lib.auto_renewals,
            web_renewals: sum.web_renewals + lib.web_renewals,
            holds_filled: sum.holds_filled + Math.round(lib.total * 0.12)
        }), {
            checkouts: 0,
            staff_renewals: 0,
            auto_renewals: 0,
            web_renewals: 0,
            holds_filled: 0
        });

        // Generate chart data
        const circulationTrendData = dailyCirculation.map(day => ({
            x: new Date(day.date),
            y: day.checkouts
        }));

        const libraryPerformanceData = libraryData.map(lib => ({
            x: lib.library_name,
            y: lib.total
        }));

        const formatBreakdownData = formatData.map(format => ({
            x: format.format,
            y: format.circulation
        }));

        const ageGroupData = [
            { x: 'Adult', y: 27494 },
            { x: 'Young Adult', y: 6874 },
            { x: 'Children', y: 11455 }
        ];

        const performanceMetricsData = [
            { x: 'Circulation Velocity', y: 2.3 },
            { x: 'Collection Turnover', y: 1.8 },
            { x: 'Holds Fill Rate', y: 0.89 },
            { x: 'Renewal Rate', y: 0.38 }
        ];

        return {
            report_metadata: {
                system: 'EVERGREEN',
                consortium_name: 'Demo Library Consortium',
                report_type: 'Circulation',
                report_period: currentMonth,
                report_period_start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
                report_period_end: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0],
                generated_date: today.toISOString(),
                generated_by: 'Evergreen ILS Dashboard',
                report_version: '1.0',
                total_circulation: totalCirculation,
                data_freshness: 'current',
                org_unit_tree_version: '2025.1'
            },
            circulation_summary: circulationSummary,
            circulation_by_library: libraryData,
            time_series_data: {
                daily_circulation: dailyCirculation,
                monthly_comparison: {
                    current_month: { period: currentMonth, total: totalCirculation },
                    previous_month: { period: 'Previous Month', total: Math.round(totalCirculation * 0.95) },
                    same_month_previous_year: { period: 'Same Month Last Year', total: Math.round(totalCirculation * 0.90) }
                }
            },
            performance_metrics: {
                circulation_velocity: 2.3,
                collection_turnover_rate: 1.8,
                holds_fill_rate: 0.89,
                renewal_rate: 0.38,
                auto_renewal_success_rate: 0.92,
                average_checkout_duration: 18.5
            },
            circ_modifier: formatData,
            circulation_by_aris: {
                summary: {
                    adult_total: 27494,
                    ya_total: 6874,
                    child_total: 11455,
                    grand_total: 45823
                },
                by_format: [
                    { format: 'Audio', adult: 3206, ya: 229, child: 1147, total: 4582 },
                    { format: 'Books', adult: 17842, ya: 5947, child: 5947, total: 29736 },
                    { format: 'Electronic', adult: 1374, ya: 458, child: 458, total: 2290 },
                    { format: 'Video', adult: 5072, ya: 240, child: 3853, total: 9165 }
                ]
            },
            dashboard_widgets: {
                kpi_summary: {
                    total_circulation: totalCirculation,
                    circulation_change_percent: 5.2,
                    top_performing_library: 'Main Library',
                    most_popular_format: 'Books',
                    digital_adoption_rate: 15.0
                },
                quick_stats: {
                    active_holds: 5000,
                    renewal_rate: 38.0,
                    consortium_libraries: 5,
                    reciprocal_borrowing_usage: 2741
                }
            },
            charts: {
                circulationTrend: {
                    title: 'Daily Circulation Trend (Last 30 Days)',
                    xAxisLabel: 'Date',
                    yAxisLabel: 'Items Circulated',
                    series: [{
                        name: 'Circulation',
                        data: circulationTrendData,
                        color: '#0066cc'
                    }],
                    accessibility: {
                        description: 'Line chart showing daily circulation trends over the last 30 days',
                        dataTable: true,
                        patterns: true
                    }
                },
                libraryPerformance: {
                    title: 'Circulation by Library',
                    xAxisLabel: 'Library',
                    yAxisLabel: 'Total Circulation',
                    series: [{
                        name: 'Circulation',
                        data: libraryPerformanceData.map((item, index) => {
                            const colors = [
                                this.EVERGREEN_COLORS.primary,    // Main Library - Blue
                                this.EVERGREEN_COLORS.success,    // North Branch - Green
                                this.EVERGREEN_COLORS.info,       // South Branch - Light Blue
                                this.EVERGREEN_COLORS.warning,    // East Branch - Orange
                                this.EVERGREEN_COLORS.secondary   // West Branch - Gray
                            ];
                            return {
                                x: item.x,
                                y: item.y,
                                color: colors[index] || this.EVERGREEN_COLORS.dark
                            };
                        })
                    }],
                    accessibility: {
                        description: 'Bar chart showing circulation performance by library',
                        dataTable: true,
                        patterns: true
                    }
                },
                formatBreakdown: {
                    title: 'Circulation by Format',
                    series: [{
                        name: 'Circulation',
                        data: formatBreakdownData.map((item, index) => {
                            const colors = [
                                this.EVERGREEN_COLORS.primary,    // Books - Blue
                                this.EVERGREEN_COLORS.danger,     // DVDs - Red
                                this.EVERGREEN_COLORS.warning,    // Audio - Orange
                                this.EVERGREEN_COLORS.success     // Electronic - Green
                            ];
                            return {
                                x: item.x,
                                y: item.y,
                                color: colors[index] || this.EVERGREEN_COLORS.info
                            };
                        })
                    }],
                    accessibility: {
                        description: 'Pie chart showing circulation breakdown by material format',
                        dataTable: true,
                        patterns: true
                    }
                },
                ageGroupAnalysis: {
                    title: 'Circulation by Age Group',
                    xAxisLabel: 'Age Group',
                    yAxisLabel: 'Circulation',
                    series: [{
                        name: 'Circulation',
                        data: ageGroupData.map((item, index) => {
                            const colors = [
                                this.EVERGREEN_COLORS.primary,    // Adult - Blue
                                this.EVERGREEN_COLORS.warning,    // Young Adult - Orange
                                this.EVERGREEN_COLORS.success     // Children - Green
                            ];
                            return {
                                x: item.x,
                                y: item.y,
                                color: colors[index] || this.EVERGREEN_COLORS.info
                            };
                        })
                    }],
                    accessibility: {
                        description: 'Bar chart showing circulation by patron age group',
                        dataTable: true,
                        patterns: true
                    }
                },
                performanceMetrics: {
                    title: 'Performance Metrics',
                    xAxisLabel: 'Metric',
                    yAxisLabel: 'Value',
                    series: [{
                        name: 'Performance',
                        data: performanceMetricsData,
                        color: '#17a2b8'
                    }],
                    accessibility: {
                        description: 'Bar chart showing key performance metrics',
                        dataTable: true,
                        patterns: true
                    }
                }
            }
        };
    }

    private async getRealData(): Promise<DashboardData> {

        // Get circulation data
        // const circData = await this.pcrud.search('action.circulation', {
        //     checkin_time: { '>': startDate },
        //     circ_lib: orgIds
        // });

        // Get patron data
        // const patronData = await this.pcrud.search('actor.usr', {
        //     create_date: { '>': startDate },
        //     home_ou: orgIds
        // });

        // Get hold data
        // const holdData = await this.pcrud.search('action.hold_request', {
        //     request_lib: orgIds,
        //     fulfillment_time: null
        // });

        // Transform and return data
        return this.getSampleData(); // Fallback to sample data for now
    }

    // ========================================================================
    // Widget Management Methods
    // ========================================================================

    /**
     * Get available widget templates
     */
    getWidgetTemplates(): Observable<any[]> {
        return this.widgetRegistry.getTemplates();
    }

    /**
     * Get widget templates by category
     */
    getWidgetTemplatesByCategory(category: string): Observable<any[]> {
        return this.widgetRegistry.getTemplatesByCategory(category);
    }

    /**
     * Create a widget from a template
     */
    createWidgetFromTemplate(templateId: string, customizations?: Partial<ChartWidgetConfig>): ChartWidgetConfig {
        return this.widgetRegistry.createWidgetFromTemplate(templateId, customizations);
    }

    /**
     * Create a circulation widget with default configuration
     */
    createCirculationWidget(overrides?: Partial<ChartWidgetConfig>): ChartWidgetConfig {
        const defaultConfig = this.widgetFactory.getDefaultConfig('monthly-circulation-by-shelving-location');

        return {
            ...defaultConfig,
            ...overrides,
            id: `circulation-widget-${Date.now()}`,
            createdDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            createdBy: this.auth.user()?.usrname || 'system'
        } as ChartWidgetConfig;
    }

    /**
     * Create a metric widget with default configuration
     */
    createMetricWidget(overrides?: Partial<ChartWidgetConfig>): ChartWidgetConfig {
        const defaultConfig = this.widgetFactory.getDefaultConfig('current-holds-metric');

        return {
            ...defaultConfig,
            ...overrides,
            id: `metric-widget-${Date.now()}`,
            chartType: 'metric',
            widgetType: 'circulations',
            createdDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            createdBy: this.auth.user()?.usrname || 'system'
        } as ChartWidgetConfig;
    }

    /**
     * Get circulation data for widgets
     */
    getCirculationDataForWidget(config: ChartWidgetConfig): Observable<any> {
        const query = this.buildCirculationQueryFromConfig(config);
        return this.circulationDataService.getCirculationByShelvingLocation(query);
    }

    /**
     * Build circulation query from widget configuration
     */
    private buildCirculationQueryFromConfig(config: ChartWidgetConfig): any {
        const { start, end } = this.getDateRangeFromConfig(config);
        const currentOrgUnit = this.org.get(this.auth.user()?.ws_ou);

        let query: any = {
            start_date: this.formatDate(start),
            end_date: this.formatDate(end),
            org_unit: currentOrgUnit?.id || 1,
            include_descendants: true
        };

        // Apply filters from config
        if (config.filters) {
            config.filters.forEach(filter => {
                if (filter.selectedValues && filter.selectedValues.length > 0) {
                    switch (filter.filterId) {
                        case 'shelving_location':
                            query.shelving_locations = filter.selectedValues;
                            break;
                        case 'material_format':
                            query.material_formats = filter.selectedValues;
                            break;
                        case 'patron_type':
                            query.patron_types = filter.selectedValues;
                            break;
                    }
                }
            });
        }

        return query;
    }

    /**
     * Get date range from widget configuration
     */
    private getDateRangeFromConfig(config: ChartWidgetConfig): { start: Date, end: Date } {
        let end = new Date();
        let start = new Date();

        if (config.timeRange === 'custom' && config.customDateRange) {
            start = new Date(config.customDateRange.start);
            end = new Date(config.customDateRange.end);
        } else {
            switch (config.timeRange) {
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
     * Format date for queries
     */
    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
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

    /**
     * Validate widget configuration
     */
    validateWidgetConfig(config: ChartWidgetConfig): { isValid: boolean; errors: string[] } {
        return this.widgetFactory.validateWidgetConfig(config);
    }

    /**
     * Get widget metadata
     */
    getWidgetMetadata(): any[] {
        return this.widgetFactory.getAllWidgetMetadata();
    }

    /**
     * Clone widget configuration
     */
    cloneWidgetConfig(config: ChartWidgetConfig): ChartWidgetConfig {
        return this.widgetFactory.cloneWidgetConfig(config);
    }

    /**
     * Update widget configuration
     */
    updateWidgetConfig(config: ChartWidgetConfig): ChartWidgetConfig {
        config.lastModified = new Date().toISOString();
        return config;
    }
}
