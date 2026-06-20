import { inject, Injectable } from '@angular/core';
import { IdlObject, IdlService } from '@eg/core/idl.service';
import { NetService } from '@eg/core/net.service';
import { HoldType } from './hold-type';
import { map, Observable } from 'rxjs';
import { EgEvent, EventService } from '@eg/core/event.service';
import { AuthService } from '@eg/core/auth.service';
import { base10Int } from '@eg/share/util/int';
import { MetarecordHoldFilter } from './metarecord-hold-filter';
import { Maybe } from '@eg/share/maybe';

export type HoldableFormatAttr = 'mr_hold_format' | 'item_lang';

@Injectable({providedIn: 'root'})
export class ChangeHoldTypeService {
    private auth = inject(AuthService);
    private evt = inject(EventService);
    private idl = inject(IdlService);
    private net = inject(NetService);

    change(
        originalHold: IdlObject,
        desiredType: HoldType,
        desiredTarget: number,
        holdableFormats: Maybe<string>): Observable<number|EgEvent> {
        const args: [string, string, string, IdlObject, HoldType, number, string?] = [
            'open-ils.circ',
            'open-ils.circ.holds.change_type.change',
            this.auth.token(),
            originalHold,
            desiredType,
            desiredTarget
        ];
        holdableFormats.whenSome(formats => args.push(formats));
        return this.net.request(...args).pipe(
            map(idOrEvent => this.maybeEgEvent(idOrEvent)),
            // OpenSRF returns the ID as a string, but it is actually an integer
            map(idOrEvent => (typeof idOrEvent === 'string') ? base10Int(idOrEvent) : idOrEvent)
        );
    }

    possibleTargets(originalHold: IdlObject, desiredType: HoldType): Observable<IdlObject|EgEvent> {
        return this.net.request(
            'open-ils.circ',
            'open-ils.circ.holds.change_type.possible_targets',
            this.auth.token(),
            originalHold,
            desiredType
        ).pipe(
            map(idOrEvent => this.maybeEgEvent(idOrEvent)),
        );
    }

    possibleTargetLabeler(desiredType: HoldType): (target: IdlObject) => string {
        switch (desiredType) {
            case HoldType.COPY:
                return target => target.barcode();
            case HoldType.VOLUME:
                return target => target.label();
            case HoldType.TITLE:
                return target => {
                    if (target.tcn_value() === target.id()) {
                        return target.id();
                    } else {
                        return $localize`:@@change-hold-type-title-target-labeler:TCN ${target.tcn_value()} (id ${target.id()})`;
                    }
                };
            case HoldType.METARECORD:
                return target => target.id();
            case HoldType.MONOPART:
                return target => target.label();
        }
    }

    /**
     * The formats and languages that a user can select for a hold on a given metarecord
     */
    metarecordHoldFilters(metarecordId: number): Observable<MetarecordHoldFilter[]>  {
        return this.net.request(
            'open-ils.circ',
            'open-ils.circ.mmr.holds.filters',
            metarecordId
        ).pipe(
            map(raw => {
                return [
                    new MetarecordHoldFilter('langs', raw.metarecord.langs.map(lang => this.idl.create(lang.classname, lang.a))),
                    new MetarecordHoldFilter('formats', raw.metarecord.formats.map(format => this.idl.create(format.classname, format.a))),
                ];
            })
        );
    }


    holdableFormatString(values: {[key in HoldableFormatAttr]: Record<string, boolean>}): string {
        const holdableFormats = Object.keys(values).reduce((acc, formatField, index) => {
            acc[index] = Object.keys(values[formatField])
                .filter(formatValue => values[formatField][formatValue])
                .map(formatValue => {
                    return {'_attr': formatField, '_val': formatValue};
                });
            return acc;
        }, {});
        return JSON.stringify(holdableFormats);
    }


    private maybeEgEvent<T>(itemOrEvent: T|object): T|EgEvent {
        const parsed = this.evt.parse(itemOrEvent);
        if (parsed) {
            return parsed;
        } else {
            return itemOrEvent as T;
        }
    }
}
