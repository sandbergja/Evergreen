import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReviewSpamComponent } from './review-spam.component';
import { Component, Input } from '@angular/core';
import { GridModule } from '@eg/share/grid/grid.module';
import { PcrudService } from '@eg/core/pcrud.service';
import { MockGenerators } from 'test_data/mock_generators';
import { GridDataSource } from '@eg/share/grid/grid';
import { AuthService } from '@eg/core/auth.service';

@Component({selector: 'eg-grid', template: 'My grid', standalone: true})
class FakeGridComponent {
    @Input() dataSource: GridDataSource;
}

@Component({selector: 'eg-grid-column', template: 'column', standalone: true})
class FakeGridColumnComponent {
    @Input() label: string;
    @Input() path: string;
    @Input() index: boolean;
    @Input() hidden: boolean;
}

@Component({selector: 'eg-grid-toolbar-action', template: 'action', standalone: true})
class FakeGridToolbarActionComponent {
    @Input() label: string;
}

describe('ReviewSpamComponent', () => {
    let component: ReviewSpamComponent;
    let fixture: ComponentFixture<ReviewSpamComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ReviewSpamComponent],
            providers: [
                {provide: AuthService, useValue: MockGenerators.authService()},
                {provide: PcrudService, useValue: MockGenerators.pcrudService({})}
            ]
        }).compileComponents();

        TestBed.overrideComponent(ReviewSpamComponent, {
            add: {imports: [FakeGridComponent, FakeGridColumnComponent, FakeGridToolbarActionComponent]},
            remove: {imports: [GridModule]}
        });

        fixture = TestBed.createComponent(ReviewSpamComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
