import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FxTrackerPage } from './fx-tracker.page';
import { FxTrackerPageRoutingModule } from './fx-tracker-routing.module';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    FxTrackerPageRoutingModule,
    SharedModule,
  ],
  declarations: [FxTrackerPage]
})
export class FxTrackerPageModule {}