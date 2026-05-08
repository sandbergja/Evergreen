import { Component, EventEmitter, inject, OnInit, output, viewChild } from '@angular/core';
import { MarkDamagedDialogComponent } from './mark-damaged-dialog.component';
import { MarkMissingDialogComponent } from './mark-missing-dialog.component';
import { MarkDiscardDialogComponent } from './mark-discard-dialog.component';
import { GridComponent } from '@eg/share/grid/grid.component';
import { IdlObject } from '@eg/core/idl.service';

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
    imports: [MarkDamagedDialogComponent, MarkMissingDialogComponent, MarkDiscardDialogComponent],
    templateUrl: './mark-item-actions.component.html'
})
export class MarkItemActionsComponent implements OnInit {

    actionFinished = output();

    private markDamagedDialog = viewChild.required(MarkDamagedDialogComponent);
    private markMissingDialog = viewChild.required(MarkMissingDialogComponent);
    private markDiscardDialog = viewChild.required(MarkDiscardDialogComponent);
    private grid = inject(GridComponent, { host: true });

    ngOnInit(): void {
        this.registerAction($localize`Mark Item Damaged`, (rows) => this.showMarkDamagedDialog(rows))
        this.registerAction($localize`Mark Item Missing`, (rows) => this.showMarkMissingDialog(rows))
        this.registerAction($localize`Mark Item Discard`, (rows) => this.showMarkDiscardDialog(rows))
    }

    private registerAction(label: string, handler: (rows: any) => void) {
        const action = {
            label: label,
            group: $localize`Mark Item`,
            onClick: new EventEmitter(),
            disableOnRows: (rows: IdlObject[]) => (rows.length < 1),
        }
        action.onClick.subscribe(handler)
        this.grid.registerToolbarAction(action)
    }


    async showMarkDamagedDialog(rows: any[]) {
        const copyIds = rows.map(r => r.cp_id).filter(id => Boolean(id));
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
            this.actionFinished.emit();
        }
    }

    showMarkMissingDialog(rows: any[]) {
        const copyIds = rows.map(r => r.cp_id).filter(id => Boolean(id));
        if (copyIds.length > 0) {
            this.markMissingDialog().copyIds = copyIds;
            this.markMissingDialog().open({}).subscribe(
                rowsModified => {
                    if (rowsModified) {
                        this.actionFinished.emit();
                    }
                }
            );
        }
    }

    showMarkDiscardDialog(rows: any[]) {
        const copyIds = rows.map(r => r.cp_id).filter(id => Boolean(id));
        if (copyIds.length > 0) {
            this.markDiscardDialog().copyIds = copyIds;
            this.markDiscardDialog().open({}).subscribe(
                rowsModified => {
                    if (rowsModified) {
                        this.actionFinished.emit();
                    }
                }
            );
        }
    }

}
