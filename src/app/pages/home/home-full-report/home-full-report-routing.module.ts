import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FullReportPage } from './home-full-report.page';

const routes: Routes = [
  {
    path: '',
    component: FullReportPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FullReportPageRoutingModule {}
