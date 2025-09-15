import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [{
    path: 'display',
    loadChildren: () =>
        import('./display/display.module').then(m => m.DashboardDisplayModule)
}, {
    path: 'designer',
    loadChildren: () =>
        import('./designer/designer.module').then(m => m.DashboardDesignerModule)
}, {
    path: '',
    redirectTo: 'display',
    pathMatch: 'full'
}];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class DashboardRoutingModule { }
