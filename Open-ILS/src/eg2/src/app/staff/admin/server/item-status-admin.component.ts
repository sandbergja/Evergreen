import { Component, inject } from '@angular/core';
import { StaffBannerComponent } from '@eg/staff/share/staff-banner.component';
import { AdminPageComponent } from '@eg/staff/share/admin-page/admin-page.component';
import { FmFieldOptions, FmRecordEditorComponent } from '@eg/share/fm-editor/fm-editor.component';
import { IdlObject } from '@eg/core/idl.service';
import { MarkItemService } from '@eg/staff/share/holdings/mark-item-service';


@Component({
    selector: 'eg-item-status-admin',
    imports: [StaffBannerComponent, AdminPageComponent, FmRecordEditorComponent],
    templateUrl: './item-status-admin.component.html',
})
export class ItemStatusAdminComponent {
    private markItem = inject(MarkItemService);

    protected readonly fieldOptions: {[fieldName: string]: FmFieldOptions} = {
        markable: {isReadonlyOverride: (_fieldName: string, record: IdlObject) => {
            return !this.markItem.forbiddenStatuses.includes(record.id());
        }}
    };
}
