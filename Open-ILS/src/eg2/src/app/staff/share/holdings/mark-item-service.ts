import { inject, Injectable, Resource, Signal } from '@angular/core';
import { AuthService } from '@eg/core/auth.service';
import { NetService } from '@eg/core/net.service';
import { BINDERY, CANCELED_TRANSIT, CATALOGING, CHECKED_OUT, DAMAGED, DISCARD_WEED, ILL,
    IN_TRANSIT, LONG_OVERDUE, LOST, MISSING, ON_HOLDS_SHELF, ON_ORDER, RESERVES } from './item-statuses';
import { from, map, mergeMap, Observable, of, reduce } from 'rxjs';
import { IdlObject } from '@eg/core/idl.service';
import { EgEvent, EventService } from '@eg/core/event.service';
import { rxResource } from '@angular/core/rxjs-interop';
import { PcrudService } from '@eg/core/pcrud.service';

/**
 * A list of items of interest to the user, grouped by whether or not
 * they are markable.
 */
export type GroupedMarkableItems = {markable: IdlObject[], unmarkable: IdlObject[]};

/**
 * A summary of a "Mark items as..." action
 */
export type MarkItemsSummary = {successes: number, events: EgEvent[]};

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
     * some other workflow in the library, so we do not allow
     * it.  This list should
     * match a constraint in the database.
     */
    forbiddenStatuses = [
        CANCELED_TRANSIT,
        CHECKED_OUT,
        IN_TRANSIT,
        LONG_OVERDUE,
        LOST,
        ON_HOLDS_SHELF,
    ];

    private auth = inject(AuthService);
    private event = inject(EventService);
    private net = inject(NetService);
    private pcrud = inject(PcrudService);

    markableItems(ids: Signal<number[]>): Resource<GroupedMarkableItems> {
        return rxResource({
            stream: ({params: itemIds}) => {
                if (itemIds.length) {
                    return this.pcrud.search('acp', {id: itemIds}, {}, {atomic: true}).pipe(map((items: IdlObject[]) => {
                        return items.reduce((grouped, item) => {
                            if (this.forbiddenStatuses.includes(item.status())) {
                                grouped.unmarkable.push(item);
                            } else {
                                grouped.markable.push(item);
                            }
                            return grouped;
                        }, {markable: [], unmarkable: []});
                    }));
                } else {
                    return of({markable: [], unmarkable: []});
                };
            },
            params: () => ids()
        });
    }

    markableStatuses(): Observable<IdlObject[]> {
        return this.net.request('open-ils.search', 'open-ils.search.config.copy_status.retrieve.all')
            .pipe(
                map((statuses: IdlObject[]) => {
                    return statuses.filter(status => (status.markable() === 't'))
                        .sort((a, b) => a.name().localeCompare(b.name()));
                }));
    }

    markItems(itemIds: number[], status: number): Observable<MarkItemsSummary> {
        if (Object.keys(MARK_ITEM_METHODS).includes(status.toString())) {
            return this.markSpecificStatusImpl(MARK_ITEM_METHODS[status.toString()], itemIds);
        } else {
            return this.markItemImpl(itemIds, status);
        }
    }

    private markItemImpl(itemIds: number[], status: number): Observable<MarkItemsSummary> {
        return from(itemIds)
            .pipe(
                mergeMap(id => this.net.request(
                    'open-ils.circ',
                    'open-ils.circ.mark_item',
                    this.auth.token(),
                    id,
                    status
                )),
                reduce((acc, result) => {
                    if (Number(result) === 1) {
                        acc.successes++;
                    } else {
                        acc.events.push(this.event.parse(result));
                    }
                    return acc;
                }, {successes: 0, events: []})
            );
    }

    private markSpecificStatusImpl(method: string, itemIds: number[]): Observable<MarkItemsSummary> {
        return from(itemIds)
            .pipe(
                mergeMap(id => this.net.request(
                    'open-ils.circ',
                    method,
                    this.auth.token(),
                    id,
                    {apply_fines: 'noapply'}
                )),
                reduce((acc, result) => {
                    if (Number(result) === 1) {
                        acc.successes++;
                    } else {
                        acc.events.push(this.event.parse(result));
                    }
                    return acc;
                }, {successes: 0, events: []})
            );
    }
}
