import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'eg-copy-notes-edit',
    templateUrl: './copy-notes-edit.component.html',
    standalone: false
})
export class CopyNotesEditComponent {

    constructor() { }

  @Input() recordId: number;
  @Output() doneWithEdits: EventEmitter<any> = new EventEmitter();
}
