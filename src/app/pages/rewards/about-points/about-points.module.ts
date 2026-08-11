import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AboutPointsPageRoutingModule } from './about-points-routing.module';
import { AboutPointsPage } from './about-points.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AboutPointsPageRoutingModule,
  ],
  declarations: [AboutPointsPage],
})
export class AboutPointsPageModule {}
