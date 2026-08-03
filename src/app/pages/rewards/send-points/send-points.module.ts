import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SendPointsPageRoutingModule } from './send-points-routing.module';

import { SendPointsPage } from './send-points.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SendPointsPageRoutingModule
  ],
  declarations: [SendPointsPage]
})
export class SendPointsPageModule {}
