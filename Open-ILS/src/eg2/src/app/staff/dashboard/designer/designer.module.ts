import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DashboardDesignerComponent } from './designer.component';
import { DashboardDesignerRoutingModule } from './routing.module';
import { StaffCommonModule } from '@eg/staff/common.module';
import { EgChartsModule } from '@eg/share/eg-charts/eg-charts.module';

@NgModule({
    declarations: [
        DashboardDesignerComponent,
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        StaffCommonModule,
        EgChartsModule,
        DashboardDesignerRoutingModule
    ],
    providers: []
})
export class DashboardDesignerModule { }
