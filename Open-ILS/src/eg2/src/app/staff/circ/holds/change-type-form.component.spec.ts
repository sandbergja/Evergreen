import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeTypeFormComponent } from './change-type-form.component';
import { MockGenerators } from 'test_data/mock_generators';
import { HoldType } from './hold-type';
import { ChangeHoldTypeService } from './change-hold-type.service';

/**
 * Yikes, Angular change detection was being difficult to work with, so we needed this
 * monster...
 */
async function waitForAWhile(fixture: ComponentFixture<ChangeTypeFormComponent>) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

describe('ChangeTypeFormComponent', () => {
    let component: ChangeTypeFormComponent;
    let fixture: ComponentFixture<ChangeTypeFormComponent>;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            imports: [ChangeTypeFormComponent],
            providers: [{provide: ChangeHoldTypeService, useValue: MockGenerators.changeHoldTypeService()}]
        });

        fixture = TestBed.createComponent(ChangeTypeFormComponent);
        fixture.componentRef.setInput('hold', MockGenerators.idlObject({hold_type: HoldType.TITLE}));
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('displays options for various hold types that you can choose', () => {
        const options: HTMLOptionElement[] = Array.from(fixture.nativeElement.querySelectorAll('option'));
        expect(options.map(option => option.textContent)).toEqual([
            'Item', 'Call number', 'Metarecord', 'Part'
        ]);
    });

    it('displays format options if the user chooses a Metarecord target', async () => {
        const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
        const metarecordIndex = Array.from(fixture.nativeElement.querySelectorAll('option'))
            .findIndex((option: HTMLOptionElement) => option.textContent === 'Metarecord');
        select.selectedIndex = metarecordIndex;
        select.dispatchEvent(new Event('change'));

        await waitForAWhile(fixture);

        const checkboxIds = Array.from(fixture.nativeElement.querySelectorAll('input[type="checkbox"]'))
            .map((checkbox: HTMLInputElement) => checkbox.getAttribute('id'));
        const labels = checkboxIds.map(id => fixture.nativeElement.querySelector(`label[for="${id}"]`).textContent);
        expect(labels).toEqual(['English', 'Spanish', 'Book', 'Large Print']);
    });
});
