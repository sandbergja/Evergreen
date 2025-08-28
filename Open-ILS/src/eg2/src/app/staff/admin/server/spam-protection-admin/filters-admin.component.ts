import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '@eg/core/auth.service';
import { IdlObject } from '@eg/core/idl.service';
import { NetService } from '@eg/core/net.service';
import { PcrudService } from '@eg/core/pcrud.service';
import { combineLatest, from, Observable, of, switchMap, toArray } from 'rxjs';
import { GridColumnSort, GridDataSource } from '@eg/share/grid/grid';
import { GridComponent } from '@eg/share/grid/grid.component';
import { StaffCommonModule } from '@eg/staff/common.module';
import { FmRecordEditorModule } from '@eg/share/fm-editor/fm-editor.module';
import { FmRecordEditorComponent } from '@eg/share/fm-editor/fm-editor.component';
import { Pager } from '@eg/share/util/pager';

type WhichTrainingSet = 'stock' | 'local';
interface MeasurementsGridRow {
    id: number;
    label: string;
    field: string;
    regularExpression: string;
    importance: number;
}

class DiagnosticData {
    accuracy: number;
    trainingSet: WhichTrainingSet;

    protected measurementImportance: number[];
    protected measurements: IdlObject[];

    constructor(
        accuracy: number,
        measurementImportance: string,
        measurements: IdlObject[],
        trainingSet: WhichTrainingSet
    ) {
        this.accuracy = accuracy;
        this.measurementImportance = this.parsePgNumericArray(measurementImportance);
        this.measurements = measurements;
        this.trainingSet = trainingSet;
    }

    getRows(_pager: Pager, _sort: GridColumnSort[]): Observable<MeasurementsGridRow> {
        const combinedMeasurementInfo:MeasurementsGridRow[] = [];
        for (let i = 0; i < this.measurements.length; i++) {
            combinedMeasurementInfo.push({
                id: this.measurements[i].id(),
                label: this.measurements[i].label(),
                field: this.fieldName(this.measurements[i].field()),
                regularExpression: this.measurements[i].regular_expression(),
                importance: this.measurementImportance[i]
            });
        }
        return from(combinedMeasurementInfo);
    }

    measurement(id: number): IdlObject {
        return this.measurements.find(measurement => id === measurement.id());
    }

    // Parse strings like "{0.123, 4.567, 0.8901}"
    private parsePgNumericArray(raw: string): number[] {
        return raw.replace('{', '').replace('}', '').split(',').map((importance) => parseFloat(importance));
    }

    private fieldName(idlClassAndField: string): string {
        switch( idlClassAndField ) {
            case 'stgu.first_given_name':
                return $localize`First name`;
            case 'stgu.second_given_name':
                return $localize`Middle name`;
            case 'stgu.family_name':
                return $localize`Last name`;
            case 'stgma.street1':
                return $localize`Street (1)`;
            case 'stgma.city':
                return $localize`City`;
            case 'stgma.post_code':
                return $localize`Postal code`;
            default:
                return idlClassAndField;
        }
    }
}


// This class is responsible for displaying an interface for managing
// the Spam Filter for the patron self-registration feature
@Component({
    selector: 'eg-spam-protection-admin-filters',
    standalone: true,
    imports: [StaffCommonModule, FmRecordEditorModule],
    templateUrl: './filters-admin.component.html'
})
export class FiltersAdminComponent implements OnInit {
    protected gridDataSource = new GridDataSource();
    protected trainingSet: WhichTrainingSet;

    @ViewChild('grid') private grid: GridComponent;
    @ViewChild('createDialog') private createDialog: FmRecordEditorComponent;
    @ViewChild('editDialog') private editDialog: FmRecordEditorComponent;

    private auth = inject(AuthService);
    private net = inject(NetService);
    private pcrud = inject(PcrudService);
    private diagnosticData: DiagnosticData;

    constructor() {
        this.refreshDataSource();
    }

    ngOnInit(): void {
        this.fetchData().subscribe();
    }

    protected updateTrainingDataSet() {
        this.net.request('open-ils.actor', 'open-ils.actor.update_spam_training_data_set', this.auth.token(), this.trainingSet)
            .pipe(switchMap(() => this.fetchData()))
            .subscribe();
    }

    protected createNew() {
        this.createDialog.open()
            .pipe(switchMap(() => this.fetchData()))
            .subscribe();
    }

    protected edit(rows: MeasurementsGridRow[]) {
        this.editDialog.recordId = rows[0].id;
        this.editDialog.open()
            .pipe(switchMap(() => this.fetchData()))
            .subscribe();
    }

    protected delete(rows: MeasurementsGridRow[]) {
        this.pcrud.remove(
            rows.map(row => this.diagnosticData.measurement(row.id))
        ).pipe(
            switchMap(() => this.fetchData())
        ).subscribe();
    }

    protected get accuracy(): number {
        return this.diagnosticData?.accuracy;
    }

    protected get initialTrainingSet(): WhichTrainingSet {
        return this.diagnosticData?.trainingSet;
    }

    private fetchData = (): Observable<boolean> => {
        const diagnosticRequest$ = this.net.request('open-ils.actor', 'open-ils.actor.spam_classifier_diagnostics', this.auth.token());
        const globalFlagRequest$ = this.net.request(
            'open-ils.actor', 'open-ils.actor.local_data_is_used_for_training', this.auth.token()
        );
        const measurementsRequest$ = this.pcrud.retrieveAll('csm').pipe(toArray());
        return combineLatest([diagnosticRequest$, globalFlagRequest$, measurementsRequest$],
            (diagnosticResponse, globalFlagResponse, measurementsResponse) => {
                const trainingSet = (globalFlagResponse === '1') ? 'local' : 'stock';
                this.diagnosticData = new DiagnosticData(
                    diagnosticResponse.accuracy,
                    diagnosticResponse.feature_importance,
                    measurementsResponse,
                    trainingSet
                );
                this.trainingSet = trainingSet;
            }).pipe(
            switchMap(() => {
                this.refreshDataSource();
                this.grid?.reload();
                return of(true);
            })
        );
    };

    private refreshDataSource() {
        this.gridDataSource.getRows = (pager, sort) => this.diagnosticData?.getRows(pager, sort) || of();
    }
}
