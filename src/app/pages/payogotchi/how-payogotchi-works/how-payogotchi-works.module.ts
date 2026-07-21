import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HowPayogotchiWorksPage } from './how-payogotchi-works.page';
import { HowPayogotchiWorksPageRoutingModule } from './how-payogotchi-works-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, HowPayogotchiWorksPageRoutingModule, SharedModule],
  declarations: [HowPayogotchiWorksPage],
})
export class HowPayogotchiWorksPageModule {}
