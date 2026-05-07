import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BINDERY, CHECKED_OUT, ItemStatusAdminComponent, itemStatusFieldOptions } from './item-status-admin.component';
import { AdminPageComponent } from '@eg/staff/share/admin-page/admin-page.component';
import { MockAdminPageComponent, MockFmRecordEditorComponent } from 'test_data/mock-components';
import { FmRecordEditorComponent } from '@eg/share/fm-editor/fm-editor.component';
import { MockGenerators } from 'test_data/mock_generators';

fdescribe('ItemStatusAdminComponent', () => {
  let component: ItemStatusAdminComponent;
  let fixture: ComponentFixture<ItemStatusAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemStatusAdminComponent]
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
    fixture.detectChanges()
    expect(fixture.nativeElement.textContent).toContain('Item Statuses')
  })
});

fdescribe("itemStatusFieldOptions", () => {
  it('does not allow marked field to be editable when the status is checked out', () => {
    const status = MockGenerators.idlObject({id: CHECKED_OUT})
    expect(itemStatusFieldOptions.markable.isReadonlyOverride("markable", status)).toBeFalse()
  })

  it('allows a marked field to be editable when the status is bindery', () => {
    const status = MockGenerators.idlObject({id: BINDERY})
    expect(itemStatusFieldOptions.markable.isReadonlyOverride("markable", status)).toBeTrue()
  })
})
