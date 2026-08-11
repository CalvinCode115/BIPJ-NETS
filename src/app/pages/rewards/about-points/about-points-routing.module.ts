import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AboutPointsPage } from './about-points.page';

const routes: Routes = [
  {
    path: '',
    component: AboutPointsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AboutPointsPageRoutingModule {}
