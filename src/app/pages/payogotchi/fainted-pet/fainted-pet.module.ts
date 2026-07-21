import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FaintedPetPage } from './fainted-pet.page';
import { FaintedPetPageRoutingModule } from './fainted-pet-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, FaintedPetPageRoutingModule, SharedModule],
  declarations: [FaintedPetPage],
})
export class FaintedPetPageModule {}
