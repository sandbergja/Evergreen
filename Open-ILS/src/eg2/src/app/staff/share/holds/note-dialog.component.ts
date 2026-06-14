import { Component, Input, inject, viewChild } from '@angular/core';
import {IdlService} from '@eg/core/idl.service';
import {PcrudService} from '@eg/core/pcrud.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {DialogComponent} from '@eg/share/dialog/dialog.component';
import { FormsModule } from '@angular/forms';
import { OpChangeComponent } from '../op-change/op-change.component';
import { lastValueFrom, switchMap } from 'rxjs';

/** New hold note dialog */

@Component({
    selector: 'eg-hold-note-dialog',
    templateUrl: 'note-dialog.component.html',
    imports: [
        FormsModule,
        OpChangeComponent
    ]
})
export class HoldNoteDialogComponent extends DialogComponent {
    private modal: NgbModal;
    private idl = inject(IdlService);
    private pcrud = inject(PcrudService);

    pub = false;
    slip = false;
    title: string;
    body: string;

    @Input() holdId: number;
    opChange = viewChild.required<OpChangeComponent>('opChange');

    constructor() {
        const modal = inject(NgbModal);
        super(modal);
        this.modal = modal;
    }

    createNote() {
        const note = this.idl.create('ahrn');
        note.staff('t');
        note.hold(this.holdId);
        note.title(this.title);
        note.body(this.body);
        note.slip(this.slip ? 't' : 'f');
        note.pub(this.pub ? 't' : 'f');

        this.pcrud.create(note).toPromise().then(
            resp => this.close(resp), // new note object
            (err: string) => {
                if (err.includes('permissions')) {
                    this.opChange().open()
                        .pipe(switchMap(() => this.pcrud.create(note)))
                        .subscribe(elevatedResp => this.close(elevatedResp));
                } else {
                    console.error('Could not create note', err);
                }
            }
        );
    }
}


