import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ScanQrPageRoutingModule } from './pay-scan-qr-routing.module';
import { ScanQrPage } from './pay-scan-qr.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, ScanQrPageRoutingModule],
  declarations: [ScanQrPage],
})
export class ScanQrPageModule {}
