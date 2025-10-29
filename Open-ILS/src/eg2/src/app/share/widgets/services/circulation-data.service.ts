import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
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
                throw error;
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
                throw error;
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
                throw error;
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
                throw error;
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
                throw error;
            })
        );
    }

}