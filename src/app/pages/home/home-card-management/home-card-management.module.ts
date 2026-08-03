import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CardManagementPageRoutingModule } from './home-card-management-routing.module';
import { CardManagementPage } from './home-card-management.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, CardManagementPageRoutingModule],
  declarations: [CardManagementPage],
})
export class CardManagementPageModule {}
