import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RewardsPage } from './rewards.page';
import { RewardsPageRoutingModule } from './rewards-routing.module';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RewardsPageRoutingModule,
    SharedModule,
  ],
  declarations: [RewardsPage]
})
export class RewardsPageModule {}
