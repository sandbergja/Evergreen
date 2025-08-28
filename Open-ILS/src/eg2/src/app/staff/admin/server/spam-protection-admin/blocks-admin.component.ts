import { Component } from '@angular/core';
import { StaffCommonModule } from '@eg/staff/common.module';
import { AdminPageModule } from '@eg/staff/share/admin-page/admin-page.module';

@Component({
    selector: 'eg-spam-protection-admin-blocks',
    standalone: true,
    imports: [AdminPageModule, StaffCommonModule],
    templateUrl: './blocks-admin.component.html'
})
export class BlocksAdminComponent {
}
