import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { QrCodePageRoutingModule } from './home-qr-code-routing.module';
import { QrCodePage } from './home-qr-code.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, QrCodePageRoutingModule],
  declarations: [QrCodePage],
})
export class QrCodePageModule {}
