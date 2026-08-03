import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NetsPointsPage } from './nets-points.page';

const routes: Routes = [
  {
    path: '',
    component: NetsPointsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NetsPointsPageRoutingModule {}
