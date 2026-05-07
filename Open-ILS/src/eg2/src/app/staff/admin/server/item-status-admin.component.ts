import { Component } from '@angular/core';
import { StaffBannerComponent } from '@eg/staff/share/staff-banner.component';
import { AdminPageComponent } from '@eg/staff/share/admin-page/admin-page.component';
import { FmFieldOptions, FmRecordEditorComponent } from '@eg/share/fm-editor/fm-editor.component';
import { IdlObject } from '@eg/core/idl.service';

export const CHECKED_OUT = 1;
export const BINDERY = 2;
export const IN_TRANSIT = 6;
export const ON_HOLDS_SHELF = 8;
export const ON_ORDER = 9;
export const ON_RESERVATIONS_SHELF = 15;

export const itemStatusFieldOptions: {[fieldName: string]: FmFieldOptions} = {
  markable: {isReadonlyOverride: (_fieldName: string, record: IdlObject) => {
    return !([CHECKED_OUT, IN_TRANSIT, ON_HOLDS_SHELF, ON_ORDER, ON_RESERVATIONS_SHELF].includes(record.id()))
  }}
}

@Component({
  selector: 'eg-item-status-admin',
  imports: [StaffBannerComponent, AdminPageComponent, FmRecordEditorComponent],
  templateUrl: './item-status-admin.component.html',
})
export class ItemStatusAdminComponent {
  protected readonly fieldOptions = itemStatusFieldOptions;
}
