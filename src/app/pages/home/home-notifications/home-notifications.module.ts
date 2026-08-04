import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HomeNotificationsPageRoutingModule } from './home-notifications-routing.module';
import { HomeNotificationsPage } from './home-notifications.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, HomeNotificationsPageRoutingModule],
  declarations: [HomeNotificationsPage],
})
export class HomeNotificationsPageModule {}
