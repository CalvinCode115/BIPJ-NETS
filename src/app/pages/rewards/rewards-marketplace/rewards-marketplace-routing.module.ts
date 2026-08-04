import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RewardsMarketplacePage } from './rewards-marketplace.page';

const routes: Routes = [
  {
    path: '',
    component: RewardsMarketplacePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RewardsMarketplacePageRoutingModule {}
