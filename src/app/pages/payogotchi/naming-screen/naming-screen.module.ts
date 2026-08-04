import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NamingScreenPage } from './naming-screen.page';
import { NamingScreenPageRoutingModule } from './naming-screen-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, NamingScreenPageRoutingModule, SharedModule],
  declarations: [NamingScreenPage],
})
export class NamingScreenPageModule {}
