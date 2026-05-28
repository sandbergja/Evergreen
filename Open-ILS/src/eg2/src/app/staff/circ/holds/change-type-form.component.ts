import { Component, computed, effect, inject, input, output, signal, WritableSignal } from '@angular/core';
import { IdlObject } from '@eg/core/idl.service';
import { HoldType, holdTypeChangeOptions, holdTypeLabel } from './hold-type';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComboboxComponent, ComboboxEntry } from '@eg/share/combobox/combobox.component';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ChangeHoldTypeService } from './change-hold-type.service';
import { EMPTY, filter, map, toArray } from 'rxjs';
import { Maybe, None, Some } from '@eg/share/maybe';
import { KeyValuePipe } from '@angular/common';
import { MetarecordHoldFilter, MetarecordHoldFilterLabelPipe } from './metarecord-hold-filter';

type TypeOption = {code: HoldType, label: string};

@Component({
    selector: 'eg-change-hold-type-form',
    templateUrl: './change-type-form.component.html',
    imports: [ComboboxComponent, KeyValuePipe, MetarecordHoldFilterLabelPipe, ReactiveFormsModule]
})
// This component provides a form for users to select a new hold type and target.
// It provides any selections as outputs.
export class ChangeTypeFormComponent {
    private changeTypeService = inject(ChangeHoldTypeService);

    protected readonly hold = input<IdlObject>();

    targetSelected = output<Maybe<number>>();
    typeSelected = output<HoldType>();
    holdableFormatSelected = output<Maybe<string>>();

    private selectMatchingTarget = effect(() => {
        const targets = this.targetOptions.value();
        // If there are no possible targets, we emit None
        if (targets?.length === 0) {
            this.targetSelected.emit(new None());
            this.targetSignal.set(null);
        // If there is only one possible target, we emit it
        } else if (targets?.length === 1) {
            this.targetSelected.emit(new Some(targets[0].id));
            this.targetSignal.set(targets[0].id);
        } else {
            this.targetSignal.set(null);
        }
    });

    protected typeOptions = computed<TypeOption[]>(() => {
        return holdTypeChangeOptions(this.hold()?.hold_type())
            .map(type => { return {code: type, label: holdTypeLabel(type)};});
    });

    protected targetOptions = rxResource<ComboboxEntry[], {originalHold: IdlObject, desiredType: HoldType}>({
        stream: ({params}) => {
            if (params.desiredType) {
                return this.changeTypeService
                    .possibleTargets(params.originalHold, params.desiredType)
                    .pipe(
                        filter(target => 'classname' in target),
                        map(target => {
                            return {
                                id: target.id(),
                                label: this.changeTypeService.possibleTargetLabeler(params.desiredType)(target)
                            };
                        }),
                        toArray()
                    );
            } else {
                return EMPTY;
            }
        },
        params: () => {return {originalHold: this.hold(), desiredType: this.desiredType()}; }
    });

    protected metarecordHoldFilters = rxResource<MetarecordHoldFilter[], {desiredTarget: number, desiredType: HoldType}>({
        stream: ({params}) => {
            if (params.desiredTarget && params.desiredType === HoldType.METARECORD) {
                return this.changeTypeService.metarecordHoldFilters(params.desiredTarget);
            } else {
                return EMPTY;
            }
        },
        params: () => {return {desiredTarget: this.selectedTarget(), desiredType: this.desiredType()};}
    });

    protected changeHoldType = new FormGroup({
        desiredType: new FormControl<HoldType>(null),
        desiredTarget: new FormControl<number>(null),
        formats: new FormControl<string>(null),
        langs: new FormControl<string>(null)
    });

    private selectedFormat = toSignal(this.changeHoldType.get('formats').valueChanges);
    private selectedLanguage = toSignal(this.changeHoldType.get('langs').valueChanges);
    private holdableFormatEffect = effect(() => {
        if (this.desiredType() === HoldType.METARECORD &&
            (this.selectedFormat() || this.selectedLanguage())) {
            const holdableFormats = {};
            if (this.selectedFormat()) {
                holdableFormats[0] = {'_val': this.selectedFormat, '_attr': 'mr_hold_format'};
            }
            if (this.selectedLanguage()) {
                holdableFormats[1] = {'_val': this.selectedLanguage, '_attr': 'item_lang'};
            }
            this.holdableFormatSelected.emit(new Some(JSON.stringify(holdableFormats)));
        } else {
            this.holdableFormatSelected.emit(new None());
        }
    });

    protected desiredType = toSignal(this.changeHoldType.get('desiredType').valueChanges);
    private targetFromSelection = toSignal(this.changeHoldType.get('desiredTarget').valueChanges);
    private targetSignal: WritableSignal<number> = signal(null);
    private selectedTarget = computed(() => this.targetSignal() || this.targetFromSelection());

    protected selectOption(entry: ComboboxEntry) {
        this.targetSelected.emit(new Some(entry.id));
    }

    protected selectType(type: HoldType) {
        this.typeSelected.emit(type);
    }
}
