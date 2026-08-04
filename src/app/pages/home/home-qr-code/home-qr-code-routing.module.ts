import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QrCodePage } from './home-qr-code.page';

const routes: Routes = [
  {
    path: '',
    component: QrCodePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QrCodePageRoutingModule {}
