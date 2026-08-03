import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RewardsMarketplacePageRoutingModule } from './rewards-marketplace-routing.module';

import { RewardsMarketplacePage } from './rewards-marketplace.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RewardsMarketplacePageRoutingModule
  ],
  declarations: [RewardsMarketplacePage]
})
export class RewardsMarketplacePageModule {}
