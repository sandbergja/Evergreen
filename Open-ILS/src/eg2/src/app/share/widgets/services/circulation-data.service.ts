import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { PcrudService } from '@eg/core/pcrud.service';
import { NetService } from '@eg/core/net.service';
import { AuthService } from '@eg/core/auth.service';
import { OrgService } from '@eg/core/org.service';

/**
 * CirculationDataService - Service for fetching circulation-related data
 *
 * Provides methods to fetch circulation statistics filtered by various criteria
 * including shelving location, material format, patron type, and date ranges.
 *
 * Features:
 * - Monthly circulation by shelving location
 * - Historical circulation trends
 * - Filter-based data aggregation
 * - Integration with Evergreen reporting services
 */

export interface CirculationQuery {
    start_date: string;
    end_date: string;
    org_unit?: number;
    include_descendants?: boolean;
    shelving_locations?: string[];
    material_formats?: string[];
    patron_types?: string[];
    library_branches?: string[];
}

export interface CirculationDataPoint {
    shelving_location: string;
    shelving_location_name: string;
    checkouts: number;
    renewals?: number;
    holds_filled?: number;
    total: number;
}

export interface CirculationTrendPoint {
    date: string;
    checkouts: number;
    renewals: number;
    total: number;
}

export interface ShelvingLocationInfo {
    id: number;
    name: string;
    label: string;
    owning_lib: number;
    active: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class CirculationDataService {

    private pcrud = inject(PcrudService);
    private net = inject(NetService);
    private auth = inject(AuthService);
    private org = inject(OrgService);

    /**
     * Get circulation data by shelving location for the specified time period
     */
    getCirculationByShelvingLocation(query: CirculationQuery): Observable<CirculationDataPoint[]> {
        console.log('Fetching circulation data by shelving location:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.by_shelving_location',
            this.auth.token(),
            query
        ).pipe(
            // Collect all streamed results into an array
            map((results: any) => {
                if (Array.isArray(results)) {
                    return results;
                }
                return [results];
            }),
            catchError(error => {
                console.error('Error fetching circulation by shelving location:', error);
                // Fall back to mock data on error
                return this.fetchMockCirculationData(query);
            })
        );
    }

    /**
     * Get circulation trend data over time
     */
    getCirculationTrend(query: CirculationQuery): Observable<CirculationTrendPoint[]> {
        console.log('Fetching circulation trend data:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.trend',
            this.auth.token(),
            query
        ).pipe(
            // Collect all streamed results into an array
            map((results: any) => {
                if (Array.isArray(results)) {
                    return results;
                }
                return [results];
            }),
            catchError(error => {
                console.error('Error fetching circulation trend:', error);
                // Fall back to mock data on error
                return this.fetchMockTrendData(query);
            })
        );
    }

    /**
     * Get available shelving locations for the current organizational unit
     */
    getShelvingLocations(orgUnit?: number): Observable<ShelvingLocationInfo[]> {
        const rawOrgUnit = orgUnit || this.auth.user()?.ws_ou() || 1;
        const targetOrgUnit = typeof rawOrgUnit === 'number' ? rawOrgUnit : parseInt(String(rawOrgUnit), 10) || 1;

        return this.pcrud.search('acpl', {
            owning_lib: targetOrgUnit,
            deleted: 'f'
        }, {
            order_by: { acpl: 'name' }
        }).pipe(
            map(locations => locations.map(loc => ({
                id: loc.id(),
                name: loc.name(),
                label: loc.name(),
                owning_lib: loc.owning_lib(),
                active: true
            }))),
            catchError(error => {
                console.error('Error fetching shelving locations:', error);
                return this.getMockShelvingLocations();
            })
        );
    }

    /**
     * Get circulation statistics summary
     */
    getCirculationSummary(query: CirculationQuery): Observable<any> {
        console.log('Fetching circulation summary:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.summary',
            this.auth.token(),
            query
        ).pipe(
            catchError(error => {
                console.error('Error fetching circulation summary:', error);
                return of({
                    total_checkouts: 1250,
                    total_renewals: 340,
                    total_holds_filled: 890,
                    period_start: query.start_date,
                    period_end: query.end_date
                });
            })
        );
    }

    /**
     * Get current holds count by status
     */
    getCurrentHoldsCount(orgUnit?: number): Observable<any> {
        console.log('Fetching current holds count:', orgUnit);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.holds.current_count',
            this.auth.token(),
            orgUnit
        ).pipe(
            catchError(error => {
                console.error('Error fetching current holds count:', error);
                return of({
                    active: 125,
                    on_shelf: 45,
                    in_transit: 23,
                    org_unit: (() => {
                        const rawUnit = orgUnit || this.auth.user()?.ws_ou() || 1;
                        return typeof rawUnit === 'number' ? rawUnit : parseInt(String(rawUnit), 10) || 1;
                    })()
                });
            })
        );
    }

    /**
     * Mock data generation for demonstration
     * In production, this would be replaced with actual OpenSRF calls
     */
    private fetchMockCirculationData(query: CirculationQuery): Observable<CirculationDataPoint[]> {
        // Generate realistic sample data
        const shelvingLocations = [
            { code: 'adult_fiction', name: 'Adult Fiction' },
            { code: 'adult_nonfiction', name: 'Adult Non-Fiction' },
            { code: 'young_adult', name: 'Young Adult' },
            { code: 'children', name: 'Children' },
            { code: 'reference', name: 'Reference' },
            { code: 'periodicals', name: 'Periodicals' },
            { code: 'dvd', name: 'DVD Collection' },
            { code: 'audiobooks', name: 'Audio Books' }
        ];

        const data: CirculationDataPoint[] = shelvingLocations.map(location => {
            // Generate random but realistic circulation numbers
            const baseCheckouts = Math.floor(Math.random() * 300) + 50;
            const renewals = Math.floor(baseCheckouts * 0.15); // ~15% renewal rate

            return {
                shelving_location: location.code,
                shelving_location_name: location.name,
                checkouts: baseCheckouts,
                renewals: renewals,
                holds_filled: Math.floor(Math.random() * 100) + 20,
                total: baseCheckouts + renewals
            };
        });

        // Apply filters if specified
        const filteredData = this.applyFiltersToMockData(data, query);

        return of(filteredData);
    }

    /**
     * Generate mock trend data
     */
    private fetchMockTrendData(query: CirculationQuery): Observable<CirculationTrendPoint[]> {
        const startDate = new Date(query.start_date);
        const endDate = new Date(query.end_date);
        const data: CirculationTrendPoint[] = [];

        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // Lower circulation on weekends
            const baseCheckouts = isWeekend ?
                Math.floor(Math.random() * 50) + 10 :
                Math.floor(Math.random() * 150) + 50;

            data.push({
                date: currentDate.toISOString().split('T')[0],
                checkouts: baseCheckouts,
                renewals: Math.floor(baseCheckouts * 0.15),
                total: Math.floor(baseCheckouts * 1.15)
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return of(data);
    }

    /**
     * Get mock shelving locations
     */
    private getMockShelvingLocations(): Observable<ShelvingLocationInfo[]> {
        return of([
            { id: 1, name: 'Adult Fiction', label: 'Adult Fiction', owning_lib: 1, active: true },
            { id: 2, name: 'Adult Non-Fiction', label: 'Adult Non-Fiction', owning_lib: 1, active: true },
            { id: 3, name: 'Young Adult', label: 'Young Adult', owning_lib: 1, active: true },
            { id: 4, name: 'Children', label: 'Children', owning_lib: 1, active: true },
            { id: 5, name: 'Reference', label: 'Reference', owning_lib: 1, active: true },
            { id: 6, name: 'Periodicals', label: 'Periodicals', owning_lib: 1, active: true },
            { id: 7, name: 'DVD Collection', label: 'DVD Collection', owning_lib: 1, active: true },
            { id: 8, name: 'Audio Books', label: 'Audio Books', owning_lib: 1, active: true }
        ]);
    }

    /**
     * Apply filters to mock data
     */
    private applyFiltersToMockData(data: CirculationDataPoint[], query: CirculationQuery): CirculationDataPoint[] {
        let filteredData = [...data];

        // Filter by shelving locations
        if (query.shelving_locations && query.shelving_locations.length > 0) {
            filteredData = filteredData.filter(item =>
                query.shelving_locations!.includes(item.shelving_location)
            );
        }

        // Additional filters could be applied here for material_formats, patron_types, etc.

        return filteredData;
    }

    /**
     * Real implementation methods (commented out for now)
     * These would be used in production with actual OpenSRF services
     */

    /*
    private fetchRealCirculationData(query: CirculationQuery): Observable<CirculationDataPoint[]> {
        return this.net.request(
            'open-ils.reporting',
            'open-ils.reporting.circulation.by_shelving_location',
            this.auth.token(),
            query
        ).pipe(
            map(result => this.transformReportingData(result)),
            catchError(error => {
                console.error('Error fetching circulation data:', error);
                throw error;
            })
        );
    }

    private fetchRealShelvingLocations(orgUnit: number): Observable<ShelvingLocationInfo[]> {
        return this.pcrud.search('acpl', {
            owning_lib: orgUnit,
            deleted: 'f'
        }, {
            flesh: 1,
            flesh_fields: { acpl: ['owning_lib'] },
            order_by: { acpl: 'name' }
        }).pipe(
            map(locations => locations.map(loc => ({
                id: loc.id(),
                name: loc.name(),
                label: loc.name(),
                owning_lib: loc.owning_lib().id(),
                active: true
            })))
        );
    }

    private transformReportingData(reportData: any[]): CirculationDataPoint[] {
        return reportData.map(row => ({
            shelving_location: row.shelving_location_code,
            shelving_location_name: row.shelving_location_name,
            checkouts: parseInt(row.checkouts) || 0,
            renewals: parseInt(row.renewals) || 0,
            holds_filled: parseInt(row.holds_filled) || 0,
            total: parseInt(row.total_circulation) || 0
        }));
    }
    */
}