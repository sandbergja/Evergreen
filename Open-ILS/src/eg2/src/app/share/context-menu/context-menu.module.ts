import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {ContextMenuDirective} from './context-menu.directive';
import {ContextMenuContainerComponent} from './context-menu-container.component';

@NgModule({
    imports: [
        CommonModule,
        ContextMenuContainerComponent,
        ContextMenuDirective,
        NgbModule
    ],
    exports: [
        ContextMenuDirective,
        ContextMenuContainerComponent
    ]
})

export class ContextMenuModule { }

