import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlocksAdminComponent } from './blocks-admin.component';
import { Component, Input } from '@angular/core';
import { AdminPageModule } from '@eg/staff/share/admin-page/admin-page.module';
import { FmFieldOptions } from '@eg/share/fm-editor/fm-editor.component';

@Component({selector: 'eg-admin-page', template: 'My {{ idlClass }} admin page', standalone: true})
class FakeAdminPageComponent {
    @Input() idlClass: string;
    @Input() fieldOptions: {[fieldName: string]: FmFieldOptions};
}

describe('BlocksAdminComponent', () => {
    let component: BlocksAdminComponent;
    let fixture: ComponentFixture<BlocksAdminComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [BlocksAdminComponent],
        }).compileComponents();

        TestBed.overrideComponent(
            BlocksAdminComponent, {
                add: { imports: [FakeAdminPageComponent]},
                remove: { imports: [AdminPageModule]},
            }
        );

        fixture = TestBed.createComponent(BlocksAdminComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('displays an admin page for the pebl IDL class', () => {
        expect(fixture.nativeElement.textContent).toContain('My pebl admin page');
    });
});
