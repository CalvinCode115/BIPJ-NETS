import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelPage } from './travel.page';
import { TravelPageRoutingModule } from './travel-routing.module';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TravelPageRoutingModule,
    SharedModule,
  ],
  declarations: [TravelPage]
})
export class TravelPageModule {}
