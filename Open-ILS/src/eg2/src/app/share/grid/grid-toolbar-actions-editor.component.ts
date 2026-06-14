import {Component, Input} from '@angular/core';
import {GridToolbarAction, GridContext} from '@eg/share/grid/grid';
import {DialogComponent} from '@eg/share/dialog/dialog.component';
import { AsyncPipe } from '@angular/common';


/** Allows users to show/hide toolbar action entries */

@Component({
    selector: 'eg-grid-toolbar-actions-editor',
    templateUrl: 'grid-toolbar-actions-editor.component.html',
    imports: [AsyncPipe]
})

export class GridToolbarActionsEditorComponent extends DialogComponent {

    @Input() gridContext: GridContext;

    showHideClicked(action: GridToolbarAction) {
        action.hidden = !action.hidden;
        this.gridContext.toolbarActions.update(action);
    }
}

