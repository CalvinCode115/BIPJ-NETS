import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MyVouchersPage } from './my-vouchers.page';

const routes: Routes = [
  {
    path: '',
    component: MyVouchersPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MyVouchersPageRoutingModule {}
