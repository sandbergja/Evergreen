import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { SpamProtectionAdminComponent } from './spam-protection-admin.component';
import { BlocksAdminComponent } from './blocks-admin.component';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReviewSpamComponent } from './review-spam.component';
import { FiltersAdminComponent } from './filters-admin.component';
import { MockGenerators } from 'test_data/mock_generators';
import { PermService } from '@eg/core/perm.service';


describe('SpamProtectionAdminComponent', () => {
    let component: SpamProtectionAdminComponent;
    let fixture: ComponentFixture<SpamProtectionAdminComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [SpamProtectionAdminComponent],
            providers: [{provide: PermService, useValue: MockGenerators.permService({ADMIN_SPAM: true})}]
        }).compileComponents();

        // Treat this test as a true unit test -- don't even attempt to
        // render child components
        TestBed.overrideComponent(
            SpamProtectionAdminComponent, {
                remove: {imports: [BlocksAdminComponent, FiltersAdminComponent, ReviewSpamComponent]},
                add: {
                    schemas: [CUSTOM_ELEMENTS_SCHEMA],
                }
            }
        );

        fixture = TestBed.createComponent(SpamProtectionAdminComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('when the user has ADMIN_SPAM permissions', () => {
        it('shows all tabs', waitForAsync(() => {
            fixture.detectChanges();
            expect(fixture.nativeElement.textContent).toContain('Blocks');
            expect(fixture.nativeElement.textContent).toContain('Filter');
            expect(fixture.nativeElement.textContent).toContain('Review spam');
        }));
        it('does not show a permissions troubleshooting message', waitForAsync(() => {
            fixture.detectChanges();
            expect(fixture.nativeElement.textContent).not.toContain('You need the MANAGE_SPAM permission to manage spam protection');
        }));
    });
});
