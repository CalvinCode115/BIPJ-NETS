import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PetSettingsPage } from './pet-settings.page';
import { PetSettingsPageRoutingModule } from './pet-settings-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PetSettingsPageRoutingModule, SharedModule],
  declarations: [PetSettingsPage],
})
export class PetSettingsPageModule {}
