import { Injectable, inject } from '@angular/core';
import { Observable, of, map, catchError, toArray, tap } from 'rxjs';
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
    getCirculationByShelvingLocation(params: any): Observable<CirculationDataPoint[]> {
        console.log('Fetching circulation data by shelving location (raw params):', params);

        // Process params - convert timeRange to dates if needed
        const query = this.processQueryParams(params);
        console.log('Processed query:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.by_shelving_location',
            this.auth.token(),
            query
        ).pipe(
            // Collect all streamed results into an array
            toArray(),
            catchError(error => {
                console.error('Error fetching circulation by shelving location:', error);
                throw error;
            })
        );
    }

    /**
     * Get circulation trend data over time
     */
    getCirculationTrend(params: any): Observable<CirculationTrendPoint[]> {
        console.log('Fetching circulation trend data (raw params):', params);

        // Process params - convert timeRange to dates if needed
        const query = this.processQueryParams(params);
        console.log('Processed query:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.trend',
            this.auth.token(),
            query
        ).pipe(
            // Collect all streamed results into an array
            toArray(),
            catchError(error => {
                console.error('Error fetching circulation trend:', error);
                throw error;
            })
        );
    }

    /**
     * Get circulation data by item type (circ_modifier)
     */
    getCirculationByItemType(params: any): Observable<any[]> {
        console.log('[CircByItemType] Raw params:', params);

        // Process params - convert timeRange to dates if needed
        const query = this.processQueryParams(params);
        console.log('[CircByItemType] Processed query:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.by_item_type',
            this.auth.token(),
            query
        ).pipe(
            // Collect all streamed results into an array
            toArray(),
            tap(data => {
                console.log('[CircByItemType] API Response:', data);
                console.log('[CircByItemType] Response length:', data?.length || 0);
                if (data && data.length > 0) {
                    console.log('[CircByItemType] First item:', data[0]);
                    console.log('[CircByItemType] Sample fields:', {
                        circ_modifier: data[0]?.circ_modifier,
                        circ_modifier_name: data[0]?.circ_modifier_name,
                        total: data[0]?.total,
                        checkouts: data[0]?.checkouts,
                        renewals: data[0]?.renewals
                    });
                } else {
                    console.warn('[CircByItemType] WARNING: API returned EMPTY array!');
                }
            }),
            catchError(error => {
                console.error('[CircByItemType] ERROR:', error);
                throw error;
            })
        );
    }

    /**
     * Get holds data by status (waiting, in-transit, on shelf, suspended)
     */
    getHoldsByStatus(params: any): Observable<any[]> {
        console.log('[HoldsByStatus] Raw params:', params);

        // Get org unit from params or default to user's ws_ou
        const orgUnit = params?.org_unit || (this.auth.user()?.ws_ou ? this.auth.user().ws_ou() : null);
        const query = {
            org_unit: orgUnit,
            include_descendants: params?.include_descendants || true
        };

        console.log('[HoldsByStatus] Processed query:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.holds.by_status',
            this.auth.token(),
            query
        ).pipe(
            toArray(),
            tap(data => {
                console.log('[HoldsByStatus] API Response:', data);
                console.log('[HoldsByStatus] Response length:', data?.length || 0);
                if (data && data.length > 0) {
                    console.log('[HoldsByStatus] First item:', data[0]);
                } else {
                    console.warn('[HoldsByStatus] WARNING: API returned EMPTY array!');
                }
            }),
            catchError(error => {
                console.error('[HoldsByStatus] ERROR:', error);
                throw error;
            })
        );
    }

    /**
     * Get items data by copy status (Available, Checked Out, In Transit, etc.)
     */
    getItemsByCopyStatus(params: any): Observable<any[]> {
        console.log('[ItemsByCopyStatus] Raw params:', params);

        // Get org unit from params or default to user's ws_ou
        const orgUnit = params?.org_unit || (this.auth.user()?.ws_ou ? this.auth.user().ws_ou() : null);
        const query = {
            org_unit: orgUnit,
            include_descendants: params?.include_descendants || true
        };

        console.log('[ItemsByCopyStatus] Processed query:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.items.by_copy_status',
            this.auth.token(),
            query
        ).pipe(
            toArray(),
            tap(data => {
                console.log('[ItemsByCopyStatus] API Response:', data);
                console.log('[ItemsByCopyStatus] Response length:', data?.length || 0);
                if (data && data.length > 0) {
                    console.log('[ItemsByCopyStatus] First item:', data[0]);
                } else {
                    console.warn('[ItemsByCopyStatus] WARNING: API returned EMPTY array!');
                }
            }),
            catchError(error => {
                console.error('[ItemsByCopyStatus] ERROR:', error);
                throw error;
            })
        );
    }

    /**
     * Get circulation data by library/branch
     */
    getCirculationByLibrary(params: any): Observable<any[]> {
        console.log('[CircByLibrary] Raw params:', params);

        // Process params - convert timeRange to dates if needed
        const query = this.processQueryParams(params);
        console.log('[CircByLibrary] Processed query:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.by_library',
            this.auth.token(),
            query
        ).pipe(
            toArray(),
            tap(data => {
                console.log('[CircByLibrary] API Response:', data);
                console.log('[CircByLibrary] Response length:', data?.length || 0);
                if (data && data.length > 0) {
                    console.log('[CircByLibrary] First item:', data[0]);
                }
            }),
            catchError(error => {
                console.error('[CircByLibrary] ERROR:', error);
                throw error;
            })
        );
    }

    /**
     * Get items data by copy status AND library (for multi-series charts)
     */
    getItemsByCopyStatusAndLibrary(params: any): Observable<any[]> {
        console.log('[ItemsByCopyStatusAndLibrary] Raw params:', params);

        // Get org unit from params or default to user's ws_ou
        const orgUnit = params?.org_unit || (this.auth.user()?.ws_ou ? this.auth.user().ws_ou() : null);
        const query = {
            org_unit: orgUnit,
            include_descendants: params?.include_descendants || true
        };

        console.log('[ItemsByCopyStatusAndLibrary] Processed query:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.items.by_copy_status_and_library',
            this.auth.token(),
            query
        ).pipe(
            toArray(),
            tap(data => {
                console.log('[ItemsByCopyStatusAndLibrary] API Response:', data);
                console.log('[ItemsByCopyStatusAndLibrary] Response length:', data?.length || 0);
                if (data && data.length > 0) {
                    console.log('[ItemsByCopyStatusAndLibrary] First item:', data[0]);
                    console.log('[ItemsByCopyStatusAndLibrary] Sample fields:', {
                        library: data[0]?.library,
                        copy_status: data[0]?.copy_status,
                        item_count: data[0]?.item_count
                    });
                } else {
                    console.warn('[ItemsByCopyStatusAndLibrary] WARNING: API returned EMPTY array!');
                }
            }),
            catchError(error => {
                console.error('[ItemsByCopyStatusAndLibrary] ERROR:', error);
                throw error;
            })
        );
    }

    /**
     * UNIFIED WIDGET DATA METHOD
     * This is the ONLY method used by all dashboard widgets.
     * All widgets query materialized tables through this method.
     * Widget configs contain complete query specifications.
     */
    getWidgetData(params: any): Observable<any[]> {
        console.log('[getWidgetData] Raw params:', params);

        // Extract query spec (merged by DataSourceRegistry)
        const querySpec = params._query;
        if (!querySpec) {
            console.error('[getWidgetData] No query spec found in params!');
            throw new Error('Query specification required for getWidgetData');
        }

        console.log('[getWidgetData] Query spec:', querySpec);

        // Get org unit from params or user's ws_ou
        const user = this.auth.user();
        const userWsOu = user?.ws_ou ? user.ws_ou() : null;
        const orgUnit = params.org_unit || this.org.get(userWsOu)?.id() || 1;

        // Build processed params (keep timeRange intact - backend needs it!)
        const processedParams = {
            org_unit: orgUnit,
            include_descendants: params.include_descendants !== false,
            timeRange: params.timeRange || 'month',
            year: params.year,
            start_month: params.start_month,
            end_month: params.end_month
        };

        console.log('[getWidgetData] Processed params:', processedParams);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.widget.data',
            this.auth.token(),
            querySpec,
            processedParams
        ).pipe(
            toArray(),
            tap(data => {
                console.log('[getWidgetData] API Response:', data);
                console.log('[getWidgetData] Response length:', data?.length || 0);
            }),
            catchError(error => {
                console.error('[getWidgetData] ERROR:', error);
                throw error;
            })
        );
    }

    /**
     * Get circulation by patron profile
     * DEPRECATED: Use getWidgetData instead
     * Kept for backward compatibility during migration
     */
    getCirculationByPatronProfile(params: any): Observable<any[]> {
        // Use 'any' type to allow adding year/month properties
        const query: any = this.processQueryParams(params);

        // Convert start_date/end_date to year/month for materialized table
        if (query.start_date) {
            const startDate = new Date(query.start_date);
            query.year = startDate.getFullYear();
            query.start_month = startDate.getMonth() + 1;
        }
        if (query.end_date) {
            const endDate = new Date(query.end_date);
            query.end_month = endDate.getMonth() + 1;
        }

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.circulation.by_patron_profile',
            this.auth.token(),
            query
        ).pipe(
            toArray(),
            catchError(error => {
                console.error('Error fetching circulation by patron profile:', error);
                return of([]);
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
    getCirculationSummary(params: any): Observable<any> {
        console.log('Fetching circulation summary (raw params):', params);

        // Process params - convert timeRange to dates if needed
        const query = this.processQueryParams(params);
        console.log('Processed query:', query);

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
    getCurrentHoldsCount(params?: any): Observable<any> {
        // Get user's workstation org - ws_ou is a FUNCTION, must call it!
        const user = this.auth.user();
        const userWsOu = user?.ws_ou ? user.ws_ou() : null;
        const orgUnit = params?.org_unit || this.org.get(userWsOu)?.id() || 1;

        // Build query hash with org_unit and include_descendants
        const query = {
            org_unit: orgUnit,
            include_descendants: params?.include_descendants !== false // Default to true
        };

        console.log('getCurrentHoldsCount called with params:', params);
        console.log('getCurrentHoldsCount - user.ws_ou():', userWsOu);
        console.log('Sending query to API:', query);

        return this.net.request(
            'open-ils.dashboard',
            'open-ils.dashboard.holds.current_count',
            this.auth.token(),
            query
        ).pipe(
            map(result => {
                console.log('🔍 getCurrentHoldsCount API Response:', result);
                console.log('🔍 Response type:', typeof result, 'isArray:', Array.isArray(result));
                console.log('🔍 Response fields:', result ? Object.keys(result) : 'null');
                return result;
            }),
            catchError(error => {
                console.error('Error fetching current holds count:', error);
                throw error;
            })
        );
    }

    /**
     * Process query parameters - converts timeRange to start_date/end_date
     * Handles both legacy CirculationQuery format and JSON widget params
     */
    private processQueryParams(params: any): CirculationQuery {
        // Get org_unit from params, user's ws_ou, or default to 1
        const user = this.auth.user();
        // ws_ou is a FUNCTION in Fieldmapper objects - must call it!
        const userWsOu = user?.ws_ou ? user.ws_ou() : null;
        const orgUnit = params.org_unit || this.org.get(userWsOu)?.id() || 1;

        console.log('processQueryParams - user:', user);
        console.log('processQueryParams - user.ws_ou():', userWsOu);
        console.log('processQueryParams - orgUnit:', orgUnit);
        console.log('processQueryParams - params.org_unit:', params.org_unit);

        // If already has start_date/end_date, return as-is
        if (params.start_date && params.end_date) {
            return params as CirculationQuery;
        }

        // Convert timeRange to actual dates
        if (params.timeRange) {
            const { start, end } = this.getDateRangeFromTimeRange(params.timeRange);
            return {
                start_date: this.formatDate(start),
                end_date: this.formatDate(end),
                org_unit: orgUnit,
                include_descendants: params.include_descendants !== false
            };
        }

        // Default to last month
        const { start, end } = this.getDateRangeFromTimeRange('month');
        return {
            start_date: this.formatDate(start),
            end_date: this.formatDate(end),
            org_unit: orgUnit,
            include_descendants: params.include_descendants !== false
        };
    }

    /**
     * Convert timeRange string to date range
     */
    private getDateRangeFromTimeRange(timeRange: string): { start: Date, end: Date } {
        const end = new Date();
        const start = new Date();
        const DAYS_IN_ONE_WEEK = 7;
        const MONTHS_IN_ONE_QUARTER = 3;

        switch (timeRange) {
            case 'today':
            case 'day':
                // Today only
                start.setHours(0, 0, 0, 0);
                // eslint-disable-next-line no-magic-numbers
                end.setHours(23, 59, 59, 999);
                break;
            case 'week':
                start.setDate(end.getDate() - DAYS_IN_ONE_WEEK);
                break;
            case 'month':
                start.setMonth(end.getMonth() - 1);
                break;
            case 'quarter':
                start.setMonth(end.getMonth() - MONTHS_IN_ONE_QUARTER);
                break;
            case 'year':
                start.setFullYear(end.getFullYear() - 1);
                break;
            default:
                // Default to month
                start.setMonth(end.getMonth() - 1);
        }

        return { start, end };
    }

    /**
     * Format date for PostgreSQL queries (YYYY-MM-DD)
     */
    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

}
