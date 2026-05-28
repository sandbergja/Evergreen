import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeTypeFormComponent } from './change-type-form.component';
import { MockGenerators } from 'test_data/mock_generators';
import { HoldType } from './hold-type';
import { ChangeHoldTypeService } from './change-hold-type.service';

describe('ChangeTypeFormComponent', () => {
    let component: ChangeTypeFormComponent;
    let fixture: ComponentFixture<ChangeTypeFormComponent>;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            imports: [ChangeTypeFormComponent],
        });
        TestBed.overrideProvider(ChangeHoldTypeService, {useValue: {}});

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
});
