import { Component, computed, inject, input, signal, OnInit } from '@angular/core';
import { ChangeTypeFormComponent } from './change-type-form.component';
import { DialogComponent } from '@eg/share/dialog/dialog.component';
import { IdlObject } from '@eg/core/idl.service';
import { HoldType } from './hold-type';
import { Maybe, None, Some } from '@eg/share/maybe';
import { ChangeHoldTypeService } from './change-hold-type.service';
import { ToastService } from '@eg/share/toast/toast.service';
import { PcrudService } from '@eg/core/pcrud.service';
import { rxResource } from '@angular/core/rxjs-interop';
import { EgEvent } from '@eg/core/event.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'eg-change-hold-type-dialog',
    templateUrl: './change-type-dialog.component.html',
    imports: [ChangeTypeFormComponent]
})
// This component provides a way for users to change the type of a hold
export class ChangeTypeDialogComponent extends DialogComponent implements OnInit {

    holdId = input.required<number>();
    protected hold = rxResource<IdlObject, {id: number}>({
        stream: ({params}) => this.pcrud.retrieve('ahr', params.id),
        params: () => {return {id: this.holdId()};}
    });

    protected canSubmit = computed(() => this.target().and(this.type()).isSome());
    protected errorMessage = signal<Maybe<string>>(new None());
    private target = signal<Maybe<number>>(new None());
    protected targetEvent = signal<Maybe<EgEvent>>(new None());
    private type = signal<Maybe<HoldType>>(new None());
    private holdableFormats = signal<Maybe<string>>(new None());

    private changeTypeService = inject(ChangeHoldTypeService);
    private pcrud = inject(PcrudService);
    private toast = inject(ToastService);

    protected change() { this.changeImpl('change'); }
    protected override() { this.changeImpl('override'); }

    private changeImpl(method: 'change'|'override') {
        this.type().whenSome(type => {
            this.target().whenSome(target => {
                this.changeTypeService[method](this.hold.value(), type, target, this.holdableFormats())
                    .subscribe(result => {
                        // Object: probably an event indicating that the Change did not go through
                        if (typeof result === 'object') {
                            this.toast.warning($localize`Could not change hold type`);
                            this.errorMessage.set(new Some(result.toString()));
                        // Likely a string that contains the new hold id as an integer
                        } else {
                            this.toast.success($localize`Changed hold type`);
                            this.close(result);
                        }
                    });
            });
        });
    }

    protected targetSelected(target: Maybe<number>) {
        this.target.set(target);
        this.errorMessage.set(new None());
    }

    targetEventSelected(event: Maybe<EgEvent>) {
        this.targetEvent.set(event);
    }

    protected typeSelected(type: HoldType) {
        this.type.set(new Some(type));
        this.errorMessage.set(new None());
    }

    protected holdableFormatSelected(formatString: Maybe<string>) {
        this.holdableFormats.set(formatString);
        this.errorMessage.set(new None());
    }
}
