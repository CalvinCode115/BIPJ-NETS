import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HatchingAnimationPage } from './hatching-animation.page';
import { HatchingAnimationPageRoutingModule } from './hatching-animation-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, HatchingAnimationPageRoutingModule, SharedModule],
  declarations: [HatchingAnimationPage],
})
export class HatchingAnimationPageModule {}
