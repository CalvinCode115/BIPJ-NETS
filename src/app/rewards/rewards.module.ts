import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RewardsPage } from './rewards.page';
import { RewardsPageRoutingModule } from './rewards-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RewardsPageRoutingModule
  ],
  declarations: [RewardsPage]
})
export class RewardsPageModule {}
