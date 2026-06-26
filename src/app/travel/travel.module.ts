import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelPage } from './travel.page';
import { TravelPageRoutingModule } from './travel-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TravelPageRoutingModule
  ],
  declarations: [TravelPage]
})
export class TravelPageModule {}
