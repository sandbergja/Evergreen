import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkItemStatusDialogComponent } from './mark-item-status-dialog.component';
import { MarkItemService } from './mark-item-service';
import { ToastService } from '@eg/share/toast/toast.service';

describe('MarkItemStatusDialogComponent', () => {
    let component: MarkItemStatusDialogComponent;
    let fixture: ComponentFixture<MarkItemStatusDialogComponent>;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            imports: [MarkItemStatusDialogComponent],
            providers: [
                {provide: MarkItemService, useValue: {}},
                {provide: ToastService, useValue: {}}
            ]
        });

        fixture = TestBed.createComponent(MarkItemStatusDialogComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
