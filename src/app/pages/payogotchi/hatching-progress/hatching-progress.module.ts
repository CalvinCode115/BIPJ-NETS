import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HatchingProgressPage } from './hatching-progress.page';
import { HatchingProgressPageRoutingModule } from './hatching-progress-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, HatchingProgressPageRoutingModule],
  declarations: [HatchingProgressPage],
})
export class HatchingProgressPageModule {}
