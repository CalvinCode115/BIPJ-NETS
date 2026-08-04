import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EggSelectionPage } from './egg-selection.page';
import { EggSelectionPageRoutingModule } from './egg-selection-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EggSelectionPageRoutingModule,
  ],
  declarations: [EggSelectionPage],
})
export class EggSelectionPageModule {}
