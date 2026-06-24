import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkItemStatusDialogComponent } from './mark-item-status-dialog.component';
import { MarkItemService } from './mark-item-service';
import { ToastService } from '@eg/share/toast/toast.service';
import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, ChangeDetectorRef, TemplateRef, inject, signal, viewChild, Resource, ResourceRef } from '@angular/core';
import { MockGenerators } from 'test_data/mock_generators';
import { AVAILABLE, CHECKED_OUT } from './item-statuses';
import { lastValueFrom, of, switchMap, tap } from 'rxjs';
import { DialogComponent } from '@eg/share/dialog/dialog.component';

@Component({
    template: `
      <ng-container *ngTemplateOutlet="modal"> </ng-container>
      <eg-mark-item-status-dialog #dialog></eg-mark-item-status-dialog>
    `,
    imports: [CommonModule, MarkItemStatusDialogComponent]
})
class MockModalComponent implements AfterViewInit {
    componentRef = viewChild<MarkItemStatusDialogComponent>('dialog');
    private cdr = inject(ChangeDetectorRef);
    modal: TemplateRef<any>;

    ngAfterViewInit() {
        this.modal = this.componentRef().dialogContent;
        this.cdr.detectChanges();
    }
}

async function setupTestingModule(
    markItemService = MockGenerators.markItemService()
): Promise<{
    fixture: ComponentFixture<MockModalComponent>;
    modalComponent: MockModalComponent;
    component: MarkItemStatusDialogComponent
}> {
    TestBed.configureTestingModule({
        imports: [MockModalComponent],
        providers: [
            {provide: MarkItemService, useValue: markItemService},
            {provide: ToastService, useValue: MockGenerators.toastService()}
        ]
    });
    const fixture = TestBed.createComponent(MockModalComponent);
    const modalComponent = fixture.componentInstance;
    modalComponent.ngAfterViewInit();
    await fixture.whenStable();
    fixture.detectChanges();
    return {fixture, modalComponent, component: modalComponent.componentRef()};
};

function getMarkButton(fixture: ComponentFixture<MockModalComponent>): HTMLButtonElement {
    const buttons: HTMLButtonElement[] = Array.from(
        fixture
            .nativeElement
            .querySelectorAll('button')
    );
    return buttons.find((button: HTMLButtonElement) => button.textContent.includes('Mark Items'));
}

describe('MarkItemStatusDialogComponent', () => {
    it('should create', async () => {
        const {modalComponent} = await setupTestingModule();
        expect(modalComponent).toBeTruthy();
    });

    it('includes a select', async () => {
        const {fixture} = await setupTestingModule();
        expect(fixture.nativeElement.querySelector('select')).toBeTruthy();
    });

    describe('when there are unmarkable items', async () => {
        it('does not display the select', async () => {
            const {fixture} = await setupTestingModule(MockGenerators.markItemService({
                markable: [MockGenerators.idlObject({barcode: '12345', status: AVAILABLE})],
                unmarkable: [MockGenerators.idlObject({barcode: '67890', status: CHECKED_OUT})]
            }));
            expect(fixture.nativeElement.querySelector('select')).toBeFalsy();
        });
    });

    describe('submitting the dialog', () => {
        it('enables the Mark Items button', async () => {
            const {fixture, component} = await setupTestingModule();
            spyOn(DialogComponent.prototype, 'open').and.returnValue(of(null));

            expect(getMarkButton(fixture).disabled).toBeFalsy();

            getMarkButton(fixture).click();
            fixture.detectChanges();

            expect(getMarkButton(fixture).disabled).toBeTruthy();

            await lastValueFrom(component.open());
            fixture.detectChanges();
            expect(getMarkButton(fixture).disabled).toBeFalsy('the button should be clickable again');
        });
    });
});
