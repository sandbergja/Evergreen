import { inject, Injectable } from '@angular/core';
import { AuthService } from '@eg/core/auth.service';
import { NetService } from '@eg/core/net.service';
import { BINDERY, CATALOGING, CHECKED_OUT, DAMAGED, DISCARD_WEED, ILL,
    IN_TRANSIT, MISSING, ON_HOLDS_SHELF, ON_ORDER, ON_RESERVATIONS_SHELF, RESERVES } from './item-statuses';
import { from, map, mergeMap, Observable, of, switchMap } from 'rxjs';
import { IdlObject } from '@eg/core/idl.service';
import { EgEvent, EventService } from '@eg/core/event.service';


/**
 * These statuses have specific "mark_item" OpenSRF methods and should
 * not use the generic `open-ils.circ.mark_item` method.
 */
const MARK_ITEM_METHODS = {
    [BINDERY]: 'open-ils.circ.mark_item_bindery',
    [CATALOGING]: 'open-ils.circ.mark_item_cataloging',
    [DAMAGED]: 'open-ils.circ.mark_item_damaged',
    [DISCARD_WEED]: 'open-ils.circ.mark_item_discard',
    [ILL]: 'open-ils.circ.mark_item_ill',
    [MISSING]: 'open-ils.circ.mark_item_missing',
    [ON_ORDER]: 'open-ils.circ.mark_item_on_order',
    [RESERVES]: 'open-ils.circ.mark_item_reserves'
};

@Injectable({providedIn: 'root'})
/**
 * This service changes items from one status to another
 * (e.g. marks the item as "missing")
 */
export class MarkItemService {
    /**
     * Marking an item as one of these statuses would break
     * another workflow in the library.  This list should
     * match a constraint in the database.
     */
    forbiddenStatuses = [
        CHECKED_OUT,
        IN_TRANSIT,
        ON_HOLDS_SHELF,
        ON_ORDER,
        ON_RESERVATIONS_SHELF,
    ];

    private auth = inject(AuthService);
    private event = inject(EventService);
    private net = inject(NetService);

    markableStatuses(): Observable<IdlObject[]> {
        return this.net.request('open-ils.search', 'open-ils.search.config.copy_status.retrieve.all')
            .pipe(
                map((statuses: IdlObject[]) => {
                    return statuses.filter(status => (status.markable() === 't'));
                }));
    }

    markItems(itemIds: number[], status: number): Observable<number|EgEvent> {
        if (Object.keys(MARK_ITEM_METHODS).includes(status.toString())) {
            return this.markSpecificStatusImpl(MARK_ITEM_METHODS[status.toString()], itemIds);
        } else {
            return this.markItemImpl(itemIds, status);
        }
    }

    private markItemImpl(itemIds: number[], status: number): Observable<number | EgEvent> {
        return from(itemIds)
            .pipe(
                mergeMap(id => this.net.request(
                    'open-ils.circ',
                    'open-ils.circ.mark_item',
                    this.auth.token(),
                    id,
                    status
                )),
                map(result => {
                    if (Number(result) === 1) {
                        return 1;
                    } else {
                        return this.event.parse(result);
                    }
                })
            );
    }

    private markSpecificStatusImpl(method: string, itemIds: number[]): Observable<number | EgEvent> {
        return from(itemIds)
            .pipe(
                mergeMap(id => this.net.request(
                    'open-ils.circ',
                    method,
                    this.auth.token(),
                    id
                )),
                map(result => {
                    if (Number(result) === 1) {
                        return 1;
                    } else {
                        return this.event.parse(result);
                    }
                })
            );
    }
}
