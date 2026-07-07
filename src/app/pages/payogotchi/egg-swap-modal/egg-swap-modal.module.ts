import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EggSwapModalPage } from './egg-swap-modal.page';
import { EggSwapModalPageRoutingModule } from './egg-swap-modal-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, EggSwapModalPageRoutingModule],
  declarations: [EggSwapModalPage],
})
export class EggSwapModalPageModule {}
