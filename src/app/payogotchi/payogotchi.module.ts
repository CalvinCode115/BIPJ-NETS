import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayogotchiPage } from './payogotchi.page';
import { PayogotchiPageRoutingModule } from './payogotchi-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    PayogotchiPageRoutingModule
  ],
  declarations: [PayogotchiPage]
})
export class PayogotchiPageModule {}
