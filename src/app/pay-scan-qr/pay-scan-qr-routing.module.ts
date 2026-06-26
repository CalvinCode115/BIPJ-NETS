import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ScanQrPage } from './pay-scan-qr.page';

const routes: Routes = [
  {
    path: '',
    component: ScanQrPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ScanQrPageRoutingModule {}
