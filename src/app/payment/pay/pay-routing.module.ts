import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PayPage } from './pay.page';

const routes: Routes = [
  {
    path: '',
    component: PayPage,
  },
  {
    path: 'pay-scan-qr',
    loadChildren: () =>
      import('../pay-scan-qr/pay-scan-qr.module').then((m) => m.ScanQrPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PayPageRoutingModule {}
