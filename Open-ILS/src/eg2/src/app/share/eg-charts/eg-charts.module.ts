import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EgChartComponent } from './eg-chart.component';
// Legacy components - for backward compatibility only
import { LineChartComponent } from './line-chart.component';
import { BarChartComponent } from './bar-chart.component';
import { PieChartComponent } from './pie-chart.component';
import { StaffCommonModule } from '@eg/staff/common.module';
import { ComboboxComponent } from '../combobox/combobox.component';

@NgModule({
    imports: [
        CommonModule,
        ComboboxComponent
    ],
    declarations: [
        EgChartComponent,
        // Legacy components for backward compatibility
        LineChartComponent,
        BarChartComponent,
        PieChartComponent
    ],
    exports: [
        EgChartComponent,
        // Legacy components for backward compatibility - prefer EgChartComponent
        LineChartComponent,
        BarChartComponent,
        PieChartComponent
    ]
})
export class EgChartsModule { }
