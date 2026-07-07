import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { WelcomeBackPage } from './welcome-back.page';
import { WelcomeBackPageRoutingModule } from './welcome-back-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, WelcomeBackPageRoutingModule],
  declarations: [WelcomeBackPage],
})
export class WelcomeBackPageModule {}
