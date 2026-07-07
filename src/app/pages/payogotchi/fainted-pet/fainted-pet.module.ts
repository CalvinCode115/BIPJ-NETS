import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FaintedPetPage } from './fainted-pet.page';
import { FaintedPetPageRoutingModule } from './fainted-pet-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, FaintedPetPageRoutingModule],
  declarations: [FaintedPetPage],
})
export class FaintedPetPageModule {}
