import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './dashboard.component';
import { DashboardRoutingModule } from './routing.module';
import { StaffCommonModule } from '@eg/staff/common.module';

@NgModule({
    declarations: [
        DashboardComponent
    ],
    imports: [
        CommonModule,
        StaffCommonModule,
        DashboardRoutingModule
    ],
    providers: []
})
export class DashboardModule { }
