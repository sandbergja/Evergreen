import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemStatusAdminComponent } from './item-status-admin.component';
import { AdminPageComponent } from '@eg/staff/share/admin-page/admin-page.component';
import { MockAdminPageComponent, MockFmRecordEditorComponent } from 'test_data/mock-components';
import { FmRecordEditorComponent } from '@eg/share/fm-editor/fm-editor.component';
import { MarkItemService } from '@eg/staff/share/holdings/mark-item-service';

describe('ItemStatusAdminComponent', () => {
    let component: ItemStatusAdminComponent;
    let fixture: ComponentFixture<ItemStatusAdminComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ItemStatusAdminComponent],
            providers: [{provide: MarkItemService, useValue: {}}]
        })
            .compileComponents();

        TestBed.overrideComponent(ItemStatusAdminComponent, {
            remove: {imports: [AdminPageComponent, FmRecordEditorComponent]},
            add: {imports: [MockAdminPageComponent, MockFmRecordEditorComponent]}
        });

        fixture = TestBed.createComponent(ItemStatusAdminComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('has a banner that says Item Statuses', () => {
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Item Statuses');
    });
});
