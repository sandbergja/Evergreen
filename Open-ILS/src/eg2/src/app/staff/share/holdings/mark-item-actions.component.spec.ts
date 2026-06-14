import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkItemActionsComponent } from './mark-item-actions.component';
import { GridComponent } from '@eg/share/grid/grid.component';
import {
    MockGridComponent, MockMarkDamagedDialogComponent, MockMarkDiscardDialogComponent,
    MockMarkItemStatusDialogComponent, MockMarkMissingDialogComponent
} from 'test_data/mock-components';
import { MarkDamagedDialogComponent } from './mark-damaged-dialog.component';
import { MarkMissingDialogComponent } from './mark-missing-dialog.component';
import { MarkDiscardDialogComponent } from './mark-discard-dialog.component';
import { BINDERY, DAMAGED, DISCARD_WEED, MISSING } from './item-statuses';
import { NetService } from '@eg/core/net.service';
import { MockGenerators } from 'test_data/mock_generators';
import { of } from 'rxjs';
import { MarkItemStatusDialogComponent } from './mark-item-status-dialog.component';

async function setupTestBed(mockGrid: MockGridComponent, mockNetService: NetService) {
    await TestBed.configureTestingModule({
        imports: [MarkItemActionsComponent],
        providers: [{provide: NetService, useValue: mockNetService}]
    }).overrideComponent(MarkItemActionsComponent, {
        remove: {
            imports: [MarkDamagedDialogComponent, MarkMissingDialogComponent, MarkDiscardDialogComponent, MarkItemStatusDialogComponent]
        }, add: {
            imports: [
                MockMarkDamagedDialogComponent, MockMarkMissingDialogComponent,
                MockMarkDiscardDialogComponent, MockMarkItemStatusDialogComponent
            ],
            providers: [{provide: GridComponent, useValue: mockGrid}]
        }
    }).compileComponents();
}

describe('MarkItemActionsComponent', () => {
    let component: MarkItemActionsComponent;
    let fixture: ComponentFixture<MarkItemActionsComponent>;
    let mockGrid: MockGridComponent;
    let mockNetService: NetService;

    beforeEach(async () => {
        mockGrid = new MockGridComponent();
    });

    describe('when Damaged, Missing, and Discard statuses are configured to be markable', () => {
        beforeEach(async () => {
            mockNetService = MockGenerators.netService({
                'open-ils.search.config.copy_status.retrieve.all': of([
                    MockGenerators.idlObject({id: DAMAGED, markable: 't'}),
                    MockGenerators.idlObject({id: MISSING, markable: 't'}),
                    MockGenerators.idlObject({id: DISCARD_WEED, markable: 't'}),
                ])
            });
            await setupTestBed(mockGrid, mockNetService);
            fixture = TestBed.createComponent(MarkItemActionsComponent);
            component = fixture.componentInstance;
            await fixture.whenStable();

        });
        it('should create', () => {
            expect(component).toBeTruthy();
        });

        it('creates a Mark Missing action by default', (done) => {
            fixture.detectChanges();
            mockGrid.context.toolbarActions.list().subscribe(list => {
                expect(list.map(a => a.label)).toContain('Mark Item Missing');
                done();
            });
        });

        it('creates a Mark Damaged action by default', (done) => {
            fixture.detectChanges();
            mockGrid.context.toolbarActions.list().subscribe(list => {
                expect(list.map(a => a.label)).toContain('Mark Item Damaged');
                done();
            });
        });

        it('can have different actions by default', (done) => {
            fixture.componentRef.setInput('defaultStatuses', [MISSING, DISCARD_WEED]);
            fixture.detectChanges();
            fixture.detectChanges();
            mockGrid.context.toolbarActions.list().subscribe(list => {
                const labels = list.map(a => a.label);
                expect(labels).toContain('Mark Item Missing');
                expect(labels).toContain('Mark Item Discard');
                expect(labels).not.toContain('Mark Item Damaged');
                done();
            });

        });

        it('defaults to being in the Mark grid action group', (done) => {
            fixture.detectChanges();
            mockGrid.context.toolbarActions.list().subscribe(actions => {
                expect(actions.length).toEqual(4);
                expect(actions[0].isGroup).toBeTrue();
                expect(actions[0].label).toEqual('Mark');
                actions.slice(1).forEach(action => expect(action.group).toEqual('Mark'));
                done();
            });
        });

        it('can use a custom group', (done) => {
            fixture.componentRef.setInput('group', 'My nice group');
            fixture.detectChanges();
            mockGrid.context.toolbarActions.list().subscribe(actions => {
                expect(actions.length).toEqual(4);
                expect(actions[0].isGroup).toBeTrue();
                expect(actions[0].label).toEqual('My nice group');
                actions.slice(1).forEach(action => expect(action.group).toEqual('My nice group'));
                done();
            });
        });
    });

    describe('when Missing and Bindery statuses are configured to be markable', () => {
        beforeEach(async () => {
            mockNetService = MockGenerators.netService({
                'open-ils.search.config.copy_status.retrieve.all': of([
                    MockGenerators.idlObject({id: MISSING, markable: 't'}),
                    MockGenerators.idlObject({id: BINDERY, markable: 't'}),
                ])
            });
            await setupTestBed(mockGrid, mockNetService);
            fixture = TestBed.createComponent(MarkItemActionsComponent);
            component = fixture.componentInstance;
            await fixture.whenStable();
        });

        it('creates a Mark Missing action', (done) => {
            fixture.detectChanges();
            mockGrid.context.toolbarActions.list().subscribe(actions => {
                expect(actions.map(a => a.label)).toContain('Mark Item Missing');
                done();
            });
        });
    });

});

