import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RenamePetPage } from './rename-pet.page';
import { RenamePetPageRoutingModule } from './rename-pet-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RenamePetPageRoutingModule],
  declarations: [RenamePetPage],
})
export class RenamePetPageModule {}
