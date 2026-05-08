// Some mock components for use in tests --
// Convenient if you are testing a parent component,
// but you don't want to have to re-implement all of
// the child's logic in your test

import { Component, input, Input, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComboboxEntry } from '@eg/share/combobox/combobox.component';
import { FmFieldOptions } from '@eg/share/fm-editor/fm-editor.component';
import { GridComponent } from '@eg/share/grid/grid.component';

@Component({
    selector: 'eg-combobox',
    template: ''
})
export class MockComboboxComponent {
    @Input() entries: ComboboxEntry[];
}

@Component({
    selector: 'eg-org-select',
    template: ''
})
export class MockOrgSelectComponent {
    @Input() disabled?: boolean;
    @Input() domId: string;
    @Input() limitPerms: string;
    @Input() ariaLabel?: string;
    @Input() disableOrgs: number[];
    @Input() required: boolean;

    @Input() applyOrgId(_id: number) {};
}

@Component({
    selector: 'eg-admin-page',
    template: ''
})
export class MockAdminPageComponent {}

@Component({
    selector: 'eg-fm-record-editor',
    template: ''
})
export class MockFmRecordEditorComponent {
    fieldOptions = input<{[fieldName: string]: FmFieldOptions}>();
}

@Component({
    selector: 'eg-grid',
    template: '',
})
export class MockGridComponent {

}

@Component({selector: 'eg-mark-damaged-dialog', template: ''})
export class MockMarkDamagedDialogComponent {}

@Component({selector: 'eg-mark-missing-dialog', template: ''})
export class MockMarkMissingDialogComponent {}

@Component({selector: 'eg-mark-discard-dialog', template: ''})
export class MockMarkDiscardDialogComponent {}
