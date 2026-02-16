import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardDisplayComponent } from './display.component';
import { DashboardDisplayRoutingModule } from './routing.module';
import { StaffCommonModule } from '@eg/staff/common.module';
import { EgChartsModule } from '@eg/share/eg-charts/eg-charts.module';

@NgModule({
    declarations: [
        DashboardDisplayComponent
    ],
    imports: [
        CommonModule,
        StaffCommonModule,
        EgChartsModule,
        DashboardDisplayRoutingModule
    ],
    providers: []
})
export class DashboardDisplayModule { }
