import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PointHistoryPage } from './point-history.page';

const routes: Routes = [
  {
    path: '',
    component: PointHistoryPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PointHistoryPageRoutingModule {}
