import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FxTrackerPage } from './fx-tracker.page';

const routes: Routes = [
  {
    path: '',
    component: FxTrackerPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FxTrackerPageRoutingModule {}