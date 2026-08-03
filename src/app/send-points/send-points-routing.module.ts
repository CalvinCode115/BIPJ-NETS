import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SendPointsPage } from './send-points.page';

const routes: Routes = [
  {
    path: '',
    component: SendPointsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SendPointsPageRoutingModule {}
