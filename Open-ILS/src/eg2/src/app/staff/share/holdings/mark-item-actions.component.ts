import { Component, EventEmitter, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { MarkDamagedDialogComponent } from './mark-damaged-dialog.component';
import { MarkMissingDialogComponent } from './mark-missing-dialog.component';
import { MarkDiscardDialogComponent } from './mark-discard-dialog.component';
import { GridComponent } from '@eg/share/grid/grid.component';
import { IdlObject } from '@eg/core/idl.service';
import { DAMAGED, DISCARD_WEED, MISSING } from './item-statuses';
import { NetService } from '@eg/core/net.service';
import { from, switchMap } from 'rxjs';
import { MarkItemStatusDialogComponent } from './mark-item-status-dialog.component';
import { GridToolbarAction } from '@eg/share/grid/grid';

export type GetIdFromRow = (row: any) => number;


/**
 * This component provides "Mark item as..." actions that staff
 * can take from item grids.
 *
 * These "Mark item as..." actions change
 * the status of the item and may have some additional logic attached
 * to them as well (for example Mark item missing or Mark item damaged
 * have circulation impacts).
 */
@Component({
    selector: 'eg-mark-item-actions',
    imports: [MarkDamagedDialogComponent, MarkMissingDialogComponent, MarkDiscardDialogComponent, MarkItemStatusDialogComponent],
    templateUrl: './mark-item-actions.component.html'
})
export class MarkItemActionsComponent implements OnInit {
    protected defaultStatuses = input<number[]>([DAMAGED, MISSING]);
    protected group = input<string>($localize`:@@1226060325201042854:Mark`);
    protected idFn = input<GetIdFromRow>((row: IdlObject) => row.cp_id);
    protected itemIds = signal([]);
    modified = output();

    private markDamagedDialog = viewChild.required(MarkDamagedDialogComponent);
    private markMissingDialog = viewChild.required(MarkMissingDialogComponent);
    private markDiscardDialog = viewChild.required(MarkDiscardDialogComponent);
    private genericMarkDialog = viewChild.required(MarkItemStatusDialogComponent);
    private grid = inject(GridComponent, { host: true });
    private net = inject(NetService);

    ngOnInit(): void {
        this.grid.context.toolbarActions.registerObservable(
            this.net.request('open-ils.search', 'open-ils.search.config.copy_status.retrieve.all')
                .pipe(
                    switchMap((statuses: IdlObject[]) => {
                        const configuredStatuses = statuses.filter(status => status.markable() === 't');
                        const defaults = this.defaultStatuses()
                            .filter(statusId => configuredStatuses.map(status => status.id()).includes(statusId))
                            .map(statusId => {
                                const action = new GridToolbarAction();
                                action.label = this.label(statusId);
                                action.group = this.group();
                                action.onClick = new EventEmitter();
                                action.disableOnRows = (rows: IdlObject[]) => (rows.length < 1);
                                action.onClick.subscribe(this.handler(statusId));
                                return action;
                            });
                        if (configuredStatuses.length > defaults.length) {
                            const genericAction = new GridToolbarAction();
                            genericAction.label = $localize`Mark as...`;
                            genericAction.group = this.group();
                            genericAction.onClick = new EventEmitter();
                            genericAction.disableOnRows = (rows: IdlObject[]) => (rows.length < 1);
                            genericAction.onClick.subscribe((rows) => this.showGenericDialog(rows));
                            return from(defaults.concat([genericAction]));
                        } else {
                            return from(defaults);
                        }

                    }),
                )
        );
    }


    private label(status: number): string {
        switch (status) {
            case DISCARD_WEED:
                return $localize`Mark Item Discard`;
            case DAMAGED:
                return $localize`Mark Item Damaged`;
            case MISSING:
                return $localize`Mark Item Missing`;
            default:
                return $localize`Mark Item...`;
        }
    }

    private handler(status: number): (rows: any) => void {
        switch(status) {
            case DAMAGED:
                return (rows) => this.showMarkDamagedDialog(rows);
            case MISSING:
                return (rows) => this.showMarkMissingDialog(rows);
            case DISCARD_WEED:
                return (rows) => this.showMarkDiscardDialog(rows);
            default:
                return (rows) => this.showGenericDialog(rows);
        }
    }


    private async showMarkDamagedDialog(rows: IdlObject[]) {
        const copyIds = this.ids(rows);
        if (copyIds.length === 0) { return; }

        let rowsModified = false;

        const markNext = async(ids: number[]) => {
            if (ids.length === 0) {
                return Promise.resolve();
            }

            this.markDamagedDialog().copyId = ids.pop();
            return this.markDamagedDialog().open({size: 'lg'}).subscribe(
                { next: ok => {
                    if (ok) { rowsModified = true; }
                    return markNext(ids);
                }, error: (dismiss: unknown) => markNext(ids) }
            );
        };

        await markNext(copyIds);
        if (rowsModified) {
            this.modified.emit();
        }
    }

    private showMarkMissingDialog(rows: IdlObject[]) {
        const copyIds = this.ids(rows);
        if (copyIds.length > 0) {
            this.markMissingDialog().copyIds = copyIds;
            this.markMissingDialog().open({}).subscribe(
                rowsModified => {
                    if (rowsModified) {
                        this.modified.emit();
                    }
                }
            );
        }
    }

    private showMarkDiscardDialog(rows: IdlObject[]) {
        const copyIds = this.ids(rows);
        if (copyIds.length > 0) {
            this.markDiscardDialog().copyIds = copyIds;
            this.markDiscardDialog().open({}).subscribe(
                rowsModified => {
                    if (rowsModified) {
                        this.modified.emit();
                    }
                }
            );
        }
    }

    private showGenericDialog(rows: IdlObject[]) {
        this.itemIds.set(this.ids(rows));
        this.genericMarkDialog().open({}).subscribe(
            rowsModified => {
                if (rowsModified) {
                    this.modified.emit();
                }
            }
        );
    }


    /**
     * Get ids from each row
     */
    private ids(rows: IdlObject[]): number[] {
        return rows
            .map(this.idFn())
            .filter((id: number) => Boolean(id));
    }

}
