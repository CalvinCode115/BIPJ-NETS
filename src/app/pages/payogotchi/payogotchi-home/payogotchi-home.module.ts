import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PayogotchiHomePage } from './payogotchi-home.page';
import { PayogotchiHomePageRoutingModule } from './payogotchi-home-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PayogotchiHomePageRoutingModule, SharedModule],
  declarations: [PayogotchiHomePage],
})
export class PayogotchiHomePageModule {}
