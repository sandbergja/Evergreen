import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardDesignerComponent } from './designer.component';

const routes: Routes = [{
    path: '',
    component: DashboardDesignerComponent
}];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class DashboardDesignerRoutingModule { }
