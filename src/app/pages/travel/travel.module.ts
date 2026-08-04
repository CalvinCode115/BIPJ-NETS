import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelPage } from './travel.page';
import { TravelPageRoutingModule } from './travel-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { CountryGlobeComponent } from '../../components/country-globe/country-globe.component';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TravelPageRoutingModule,
    SharedModule,
  ],
  declarations: [TravelPage, CountryGlobeComponent],
})
export class TravelPageModule {}
