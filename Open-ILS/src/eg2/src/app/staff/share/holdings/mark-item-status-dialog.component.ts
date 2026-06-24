import { ChangeDetectionStrategy, Component, computed, inject, input, Input, OnInit, signal, viewChild } from '@angular/core';
import { IdlObject } from '@eg/core/idl.service';
import { DialogComponent } from '@eg/share/dialog/dialog.component';
import { CHECKED_OUT, IN_TRANSIT } from './item-statuses';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MarkItemService, MarkItemsSummary } from './mark-item-service';
import { ToastService } from '@eg/share/toast/toast.service';
import { NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

/**
 * This dialog allows a user with sufficient permission to change the status of the provided items
 */
@Component({
    selector: 'eg-mark-item-status-dialog',
    imports: [ReactiveFormsModule],
    templateUrl: './mark-item-status-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarkItemStatusDialogComponent extends DialogComponent implements OnInit {
    itemIds = input<number[]>();

    protected statuses: IdlObject[] = [];

    protected currentlyCheckedOut = computed(() => this.items.value()?.unmarkable.some(item => item.status() === CHECKED_OUT));
    protected currentlyInTransit = computed(() => this.items.value()?.unmarkable.some(item => item.status() === IN_TRANSIT));

    protected status = new FormControl<number>(null);

    protected summary: MarkItemsSummary = {successes: 0, events: []};

    private toast = inject(ToastService);
    private markService = inject(MarkItemService);

    protected items = this.markService.markableItems(this.itemIds);
    protected submitted = signal(false);

    protected markItems() {
        this.submitted.set(true);
        this.markService.markItems(this.itemIds(), this.selectedStatus)
            .subscribe(response => {
                this.summary = response;
                if (this.summary.successes && !this.summary.events.length) {
                    this.toast.success($localize`Item(s) marked`);
                    this.close(response);
                }
            });
    }

    ngOnInit(): void {
        this.markService.markableStatuses()
            .subscribe(statuses => this.statuses = statuses.filter(s => !this.markService.forbiddenStatuses.includes(s.id())));
    }

    open(args?: NgbModalOptions): ReturnType<DialogComponent['open']> {
        this.submitted.set(false);
        return super.open(args);
    }

    private get selectedStatus(): number {
        return this.status.value;
    }

}
