import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardDisplayComponent } from './display.component';

const routes: Routes = [{
    path: '',
    component: DashboardDisplayComponent
}];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class DashboardDisplayRoutingModule { }
