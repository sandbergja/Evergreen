import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkItemActionsComponent } from './mark-item-actions.component';
import { GridComponent } from '@eg/share/grid/grid.component';
import { MockGridComponent, MockMarkDamagedDialogComponent, MockMarkDiscardDialogComponent, MockMarkMissingDialogComponent } from 'test_data/mock-components';
import { MarkDamagedDialogComponent } from './mark-damaged-dialog.component';
import { MarkMissingDialogComponent } from './mark-missing-dialog.component';
import { MarkDiscardDialogComponent } from './mark-discard-dialog.component';


describe('MarkItemActionsComponent', () => {
    let component: MarkItemActionsComponent;
    let fixture: ComponentFixture<MarkItemActionsComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MarkItemActionsComponent],
        }).overrideComponent(MarkItemActionsComponent, {
          remove: {
            imports: [MarkDamagedDialogComponent, MarkMissingDialogComponent, MarkDiscardDialogComponent]
          }, add: {
            imports: [MockMarkDamagedDialogComponent, MockMarkMissingDialogComponent, MockMarkDiscardDialogComponent],
            providers: [{provide: GridComponent, useClass: MockGridComponent}]
          }
        }).compileComponents();

        fixture = TestBed.createComponent(MarkItemActionsComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
