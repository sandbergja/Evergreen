import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit, output, signal, WritableSignal } from '@angular/core';
import { IdlObject } from '@eg/core/idl.service';
import { HoldType, holdTypeChangeOptions, holdTypeLabel } from './hold-type';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComboboxComponent, ComboboxEntry } from '@eg/share/combobox/combobox.component';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ChangeHoldTypeService, HoldableFormatAttr } from './change-hold-type.service';
import { map, of } from 'rxjs';
import { Maybe, None, Some, toMaybe } from '@eg/share/maybe';
import { KeyValuePipe } from '@angular/common';
import { MetarecordHoldFilter, MetarecordHoldFilterLabelPipe } from './metarecord-hold-filter';
import { EgEvent } from '@eg/core/event.service';

type TypeOption = {code: HoldType, label: string};

@Component({
    selector: 'eg-change-hold-type-form',
    templateUrl: './change-type-form.component.html',
    imports: [ComboboxComponent, KeyValuePipe, MetarecordHoldFilterLabelPipe, ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
// This component provides a form for users to select a new hold type and target.
// It provides any selections as outputs.
export class ChangeTypeFormComponent {
    private changeTypeService = inject(ChangeHoldTypeService);

    protected readonly hold = input<IdlObject>();

    targetSelected = output<Maybe<number>>();
    targetEventSelected = output<Maybe<EgEvent>>();
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
    private selectEventEffect = effect(() => {
        if (!this.selectedTarget()) { this.targetEventSelected.emit(new None()); };
        const selected = this.targetOptions.value()
            ?.find(option => option.id === this.selectedTarget())
            ?.userdata;
        this.targetEventSelected.emit(toMaybe(selected));
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
                        map(
                            targets => {
                                return targets.map(target => {
                                    return {
                                        id: target.idlObject.id(),
                                        label: this.changeTypeService.possibleTargetLabeler(params.desiredType)(target.idlObject),
                                        userdata: target.event
                                    };
                                });
                            }
                        )
                    );
            } else {
                return of([]);
            }
        },
        params: () => {return {originalHold: this.hold(), desiredType: this.desiredType()}; }
    });

    protected metarecordHoldFilters = rxResource<MetarecordHoldFilter[], {desiredTarget: number, desiredType: HoldType}>({
        stream: ({params}) => {
            if (params.desiredTarget && params.desiredType === HoldType.METARECORD) {
                return this.changeTypeService.metarecordHoldFilters(params.desiredTarget);
            } else {
                return of([]);
            }
        },
        params: () => {return {desiredTarget: this.selectedTarget(), desiredType: this.desiredType()};}
    });

    protected changeHoldType = new FormGroup({
        desiredType: new FormControl<HoldType>(null),
        desiredTarget: new FormControl<ComboboxEntry>(null),
        formats: new FormGroup({}),
        langs: new FormGroup({})
    });
    private updateCheckboxesEffect = effect(() => {
        this.metarecordHoldFilters.value()?.forEach(mrFilter => {
            if (mrFilter.name === 'formats') {
                const formats = this.changeHoldType.get('formats') as FormGroup;
                Object.keys(formats.controls).forEach(control => formats.removeControl(control));
                Object.keys(mrFilter.options()).forEach(key => {
                    formats.addControl(key, new FormControl<boolean>(false));
                });
            } else if (mrFilter.name === 'langs') {
                const langs = this.changeHoldType.get('langs') as FormGroup;
                Object.keys(langs.controls).forEach(control => langs.removeControl(control));
                Object.keys(mrFilter.options()).forEach(key => {
                    langs.addControl(key, new FormControl<boolean>(false));
                });
            }
        });
    });

    private selectedFormats = toSignal(this.changeHoldType.get('formats').valueChanges);
    private selectedLanguages = toSignal(this.changeHoldType.get('langs').valueChanges);
    private holdableFormatEffect = effect(() => {
        if (this.desiredType() === HoldType.METARECORD &&
            (this.selectedFormats() || this.selectedLanguages())) {
            const holdableFormats = {} as {[key in HoldableFormatAttr]: Record<string, boolean>};
            if (this.selectedFormats()) {
                holdableFormats['mr_hold_format'] = this.selectedFormats();
            }
            if (this.selectedLanguages()) {
                holdableFormats['item_lang'] = this.selectedLanguages();
            }
            this.holdableFormatSelected.emit(new Some(this.changeTypeService.holdableFormatString(holdableFormats)));
        } else {
            this.holdableFormatSelected.emit(new None());
        }
    });

    protected desiredType = toSignal(this.changeHoldType.get('desiredType').valueChanges);
    private targetEntryFromSelection = toSignal<ComboboxEntry>(this.changeHoldType.get('desiredTarget').valueChanges);
    private targetSignal: WritableSignal<number> = signal(null);
    private selectedTarget = computed(() => this.targetSignal() || this.targetEntryFromSelection()?.id);

    protected selectOption(entry: ComboboxEntry) {
        this.targetSelected.emit(new Some(entry.id));
    }

    protected selectType(type: HoldType) {
        this.typeSelected.emit(type);
    }
}
