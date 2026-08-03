import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PartnerChallengesPage } from './partner-challenges.page';

const routes: Routes = [
  {
    path: '',
    component: PartnerChallengesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PartnerChallengesPageRoutingModule {}
