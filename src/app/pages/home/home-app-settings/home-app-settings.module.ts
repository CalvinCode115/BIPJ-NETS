import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HomeAppSettingsPageRoutingModule } from './home-app-settings-routing.module';
import { HomeAppSettingsPage } from './home-app-settings.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, HomeAppSettingsPageRoutingModule],
  declarations: [HomeAppSettingsPage],
})
export class HomeAppSettingsPageModule {}
