import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NetsPointsPageRoutingModule } from './nets-points-routing.module';

import { NetsPointsPage } from './nets-points.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NetsPointsPageRoutingModule
  ],
  declarations: [NetsPointsPage]
})
export class NetsPointsPageModule {}
