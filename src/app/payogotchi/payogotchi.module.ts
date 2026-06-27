import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayogotchiPage } from './payogotchi.page';
import { PayogotchiPageRoutingModule } from './payogotchi-routing.module';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    PayogotchiPageRoutingModule,
    SharedModule,
  ],
  declarations: [PayogotchiPage]
})
export class PayogotchiPageModule {}
