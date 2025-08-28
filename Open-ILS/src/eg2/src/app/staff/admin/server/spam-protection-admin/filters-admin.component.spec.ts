import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { FiltersAdminComponent } from './filters-admin.component';
import { NetService } from '@eg/core/net.service';
import { of } from 'rxjs';
import { MockGenerators } from 'test_data/mock_generators';
import { PcrudService } from '@eg/core/pcrud.service';
import { AuthService } from '@eg/core/auth.service';
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { GridDataSource } from '@eg/share/grid/grid';
import { JsonPipe, PercentPipe } from '@angular/common';
import { StaffCommonModule } from '@eg/staff/common.module';
import { FormsModule } from '@angular/forms';
import { FmRecordEditorModule } from '@eg/share/fm-editor/fm-editor.module';

@Component({
    selector: 'eg-grid',
    standalone: true,
    imports: [JsonPipe],
    template: '{{ dataSource?.data | json }}'
})
class FakeGridComponent {
    @Input() dataSource: GridDataSource;
    @Input() sortable: boolean;
    @Input() useLocalSort: boolean;
    @Input() disablePaging: boolean;
}

const mockNetService = jasmine.createSpyObj<NetService>(['request']);
mockNetService.request.and.callFake((_service, method) => {
    if (method === 'open-ils.actor.spam_classifier_diagnostics') {
        return of({
            accuracy: 0.983,
            feature_importance: '{2.244873}'
        });
    } else if (method === 'open-ils.actor.local_data_is_used_for_training') {
        return of('1');
    }
});
const mockPcrudService = MockGenerators.pcrudService({
    retrieveAll: MockGenerators.idlObject({
        id: 25,
        label: 'first name contains an advertisement',
        field: 'stgu.first_given_name',
        regular_expression: '\bBUY BUY BUY!!!\b'
    })
});

describe('FilterAdminComponent', () => {
    let component: FiltersAdminComponent;
    let fixture: ComponentFixture<FiltersAdminComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FiltersAdminComponent],
            providers: [
                {provide: NetService, useValue: mockNetService},
                {provide: PcrudService, useValue: mockPcrudService},
                {provide: AuthService, useValue: MockGenerators.authService()}
            ]
        }).compileComponents();
        TestBed.overrideComponent(FiltersAdminComponent, {
            add: {
                imports: [FakeGridComponent, FormsModule, PercentPipe],
                schemas: [CUSTOM_ELEMENTS_SCHEMA]
            },
            remove: {imports: [StaffCommonModule, FmRecordEditorModule]},
        });

        fixture = TestBed.createComponent(FiltersAdminComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('displays the accuracy percentage', waitForAsync(() => {
        expect(fixture.nativeElement.textContent).toContain('98%');
    }));

    it('shows that the global flag has selected our own local data ', waitForAsync(() => {
        const selected = fixture.nativeElement.querySelector('select').selectedOptions;
        expect(selected.length).toEqual(1);
        expect(selected[0].textContent).toContain('Our own local data');
    }));
});
