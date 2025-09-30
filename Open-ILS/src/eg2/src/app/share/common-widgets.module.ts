/*
  Module for grouping commonly used widgets that might be embedded
  in other shared components. Components included here should be
  unlikely to ever need to embed one another.
*/
import {NgModule, ModuleWithProviders} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {EgCoreModule} from '@eg/core/core.module';
import {ButtonStyleDirective} from '@eg/share/util/button-style.directive';
import {ComboboxComponent, IdlClassTemplateDirective} from '@eg/share/combobox/combobox.component';
import {ComboboxEntryComponent} from '@eg/share/combobox/combobox-entry.component';
import {DateSelectComponent} from '@eg/share/date-select/date-select.component';
import {BooleanSelectComponent} from '@eg/share/boolean-select/boolean-select.component';
import {OrgSelectComponent} from '@eg/share/org-select/org-select.component';
import {DepthSelectComponent} from '@eg/share/depth-select/depth-select.component';
import {DateRangeSelectComponent} from '@eg/share/daterange-select/daterange-select.component';
import {DateTimeSelectComponent} from '@eg/share/datetime-select/datetime-select.component';
import {ContextMenuModule} from '@eg/share/context-menu/context-menu.module';
import {FileReaderComponent} from '@eg/share/file-reader/file-reader.component';
import {IntervalInputComponent} from '@eg/share/interval-input/interval-input.component';
import {ClipboardDialogComponent} from '@eg/share/clipboard/clipboard-dialog.component';
import { CredentialInputComponent } from './util/credential-input.component';
import { EgChartsModule } from '@eg/share/eg-charts/eg-charts.module';

// Widget components - TypeScript-based widgets
import { BaseWidgetComponent } from './widgets/base/base-widget.component';
import { ChartWidgetComponent } from './widgets/base/chart-widget.component';
import { MetricWidgetComponent } from './widgets/base/metric-widget.component';
import { CirculationWidgetComponent } from './widgets/circulation/circulation-widget.component';
import { CirculationMetricWidgetComponent } from './widgets/circulation/circulation-metric-widget.component';
import { MonthlyCirculationByShelvingLocationWidget } from './widgets/circulation/monthly-circulation-by-shelving-location.widget';
import { CurrentHoldsMetricWidget } from './widgets/circulation/current-holds-metric.widget';

// JSON-driven widget components
import { JsonWidgetComponent } from './widgets/json/json-widget.component';
import { JsonChartWidgetComponent } from './widgets/json/json-chart-widget.component';
import { JsonMetricWidgetComponent } from './widgets/json/json-metric-widget.component';

// Widget services
import { CirculationDataService } from './widgets/services/circulation-data.service';
import { WidgetFactoryService } from './widgets/factories/widget.factory';
import { WidgetRegistryService } from './widgets/services/widget-registry.service';
import { DataSourceRegistryService } from './widgets/services/data-source-registry.service';

// Widget engines
import { TransformEngine } from './widgets/engines/transform.engine';
import { WidgetConfigEngine } from './widgets/engines/widget-config.engine';

// Widget validators
import { WidgetConfigValidator } from './widgets/validators/widget-config.validator';


@NgModule({
    declarations: [
        ButtonStyleDirective,
        ComboboxComponent,
        ComboboxEntryComponent,
        DateSelectComponent,
        BooleanSelectComponent,
        OrgSelectComponent,
        DepthSelectComponent,
        DateRangeSelectComponent,
        DateTimeSelectComponent,
        FileReaderComponent,
        ClipboardDialogComponent,
        IdlClassTemplateDirective,
        IntervalInputComponent,
        CredentialInputComponent,
        // TypeScript-based widget components - only concrete implementations can be declared
        MonthlyCirculationByShelvingLocationWidget,
        CurrentHoldsMetricWidget,
        // JSON-driven widget components
        JsonWidgetComponent,
        JsonChartWidgetComponent,
        JsonMetricWidgetComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NgbModule,
        EgCoreModule,
        ContextMenuModule,
        EgChartsModule
    ],
    exports: [
        CommonModule,
        FormsModule,
        NgbModule,
        EgCoreModule,
        ButtonStyleDirective,
        ComboboxComponent,
        ComboboxEntryComponent,
        DateSelectComponent,
        BooleanSelectComponent,
        OrgSelectComponent,
        DepthSelectComponent,
        DateRangeSelectComponent,
        DateTimeSelectComponent,
        ClipboardDialogComponent,
        ContextMenuModule,
        FileReaderComponent,
        IntervalInputComponent,
        CredentialInputComponent,
        EgChartsModule,
        // TypeScript-based widget components - only concrete implementations can be exported
        MonthlyCirculationByShelvingLocationWidget,
        CurrentHoldsMetricWidget,
        // JSON-driven widget components
        JsonWidgetComponent,
        JsonChartWidgetComponent,
        JsonMetricWidgetComponent
    ],
    providers: [
        // Widget services
        CirculationDataService,
        WidgetFactoryService,
        WidgetRegistryService,
        DataSourceRegistryService,
        // Widget engines
        TransformEngine,
        WidgetConfigEngine,
        // Widget validators
        WidgetConfigValidator
    ],
})

export class CommonWidgetsModule { }
