import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RenamePetPage } from './rename-pet.page';
import { RenamePetPageRoutingModule } from './rename-pet-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RenamePetPageRoutingModule, SharedModule],
  declarations: [RenamePetPage],
})
export class RenamePetPageModule {}
