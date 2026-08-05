import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TravelPage } from './travel.page';
import { TravelPageRoutingModule } from './travel-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { CountryGlobeComponent } from '../../components/country-globe/country-globe.component';
import { DayMapComponent } from '../../components/day-map/day-map.component';
import { GoogleMapsLoaderService } from 'src/app/services/google-maps-loader.service';


@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TravelPageRoutingModule,
    SharedModule,
  ],
  declarations: [TravelPage, CountryGlobeComponent,DayMapComponent],
  providers: [GoogleMapsLoaderService],
})
export class TravelPageModule {}
