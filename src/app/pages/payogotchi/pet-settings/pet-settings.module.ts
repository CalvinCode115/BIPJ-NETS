import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PetSettingsPage } from './pet-settings.page';
import { PetSettingsPageRoutingModule } from './pet-settings-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PetSettingsPageRoutingModule],
  declarations: [PetSettingsPage],
})
export class PetSettingsPageModule {}
