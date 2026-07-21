import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayPage } from './pay.page';
import { PayPageRoutingModule } from './pay-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    PayPageRoutingModule
  ],
  declarations: [PayPage]
})
export class PayPageModule {}
