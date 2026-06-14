import { ChangeDetectionStrategy, Component, computed, inject, Input, OnInit } from '@angular/core';
import { IdlObject } from '@eg/core/idl.service';
import { DialogComponent } from '@eg/share/dialog/dialog.component';
import { CHECKED_OUT, DAMAGED, IN_TRANSIT } from './item-statuses';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MarkItemService } from './mark-item-service';
import { ToastService } from '@eg/share/toast/toast.service';

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
  @Input() itemId: number;
  @Input() currentStatusId: number;
  protected statuses: IdlObject[] = [];

  protected currentlyCheckedOut = computed(() => this.currentStatusId === CHECKED_OUT);
  protected currentlyInTransit = computed(() => this.currentStatusId === IN_TRANSIT);

  protected status = new FormControl<number>(null);
  private toast = inject(ToastService);

  private markService = inject(MarkItemService);
  private forbiddenStatuses = [
      // Damaged has various parameters related to circulation
      // behavior -- it is better to handle it in its own
      // dedicated dialog than in this general dialog
      DAMAGED,
  ].concat(this.markService.forbiddenStatuses);

  protected markItems() {
      this.markService.markItems([this.itemId], this.selectedStatus)
          .subscribe(response => {
              if (Number(response)) {
                  this.toast.success($localize`Item(s) marked`);
                  this.close(response);
              } else {
                  this.toast.warning($localize`Could not mark item(s)`);
              }
          });
  }

  ngOnInit(): void {
      this.markService.markableStatuses()
          .subscribe(statuses => this.statuses = statuses.filter(s => !this.forbiddenStatuses.includes(s.id())));
  }

  private get selectedStatus(): number {
      return this.status.value;
  }

}
