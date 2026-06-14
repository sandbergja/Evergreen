import { Component } from '@angular/core';
import { StaffBannerComponent } from '@eg/staff/share/staff-banner.component';
import { AdminPageComponent } from '@eg/staff/share/admin-page/admin-page.component';
import { FmFieldOptions, FmRecordEditorComponent } from '@eg/share/fm-editor/fm-editor.component';
import { IdlObject } from '@eg/core/idl.service';
import { CHECKED_OUT, IN_TRANSIT, ON_HOLDS_SHELF, ON_ORDER, ON_RESERVATIONS_SHELF } from '@eg/staff/share/holdings/item-statuses';

export const itemStatusFieldOptions: {[fieldName: string]: FmFieldOptions} = {
    markable: {isReadonlyOverride: (_fieldName: string, record: IdlObject) => {
        return !([CHECKED_OUT, IN_TRANSIT, ON_HOLDS_SHELF, ON_ORDER, ON_RESERVATIONS_SHELF].includes(record.id()));
    }}
};

@Component({
    selector: 'eg-item-status-admin',
    imports: [StaffBannerComponent, AdminPageComponent, FmRecordEditorComponent],
    templateUrl: './item-status-admin.component.html',
})
export class ItemStatusAdminComponent {
    protected readonly fieldOptions = itemStatusFieldOptions;
}
