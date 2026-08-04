import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MorePageRoutingModule } from './home-more-routing.module';
import { MorePage } from './home-more.page';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, MorePageRoutingModule],
  declarations: [MorePage],
})
export class MorePageModule {}
