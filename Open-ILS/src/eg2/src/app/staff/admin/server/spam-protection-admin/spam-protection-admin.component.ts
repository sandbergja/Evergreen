import { Component, inject, OnInit } from '@angular/core';
import { StaffCommonModule } from '@eg/staff/common.module';
import { BlocksAdminComponent } from './blocks-admin.component';
import { ReviewSpamComponent } from './review-spam.component';
import { FiltersAdminComponent } from './filters-admin.component';
import { PermService } from '@eg/core/perm.service';

@Component({
    selector: 'eg-spam-protection-admin',
    standalone: true,
    imports: [StaffCommonModule, BlocksAdminComponent, FiltersAdminComponent, ReviewSpamComponent],
    templateUrl: './spam-protection-admin.component.html'
})
export class SpamProtectionAdminComponent implements OnInit{
    private perm = inject(PermService);
    protected sufficientPerms: boolean = false;

    async ngOnInit(): Promise<boolean> {
        return this.perm.hasWorkPermHere('ADMIN_SPAM').then(result => {
            console.log('ADMIN SPAM', result['ADMIN_SPAM']);
            this.sufficientPerms = result['ADMIN_SPAM'];
            return result['ADMIN_SPAM'];
        });
    }
}
