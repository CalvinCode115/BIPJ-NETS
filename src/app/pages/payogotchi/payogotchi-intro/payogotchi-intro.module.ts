import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PayogotchiIntroPage } from './payogotchi-intro.page';
import { PayogotchiIntroPageRoutingModule } from './payogotchi-intro-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PayogotchiIntroPageRoutingModule, SharedModule],
  declarations: [PayogotchiIntroPage],
})
export class PayogotchiIntroPageModule {}
