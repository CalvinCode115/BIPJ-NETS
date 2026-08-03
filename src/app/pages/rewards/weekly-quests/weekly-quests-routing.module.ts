import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WeeklyQuestsPage } from './weekly-quests.page';

const routes: Routes = [
  {
    path: '',
    component: WeeklyQuestsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WeeklyQuestsPageRoutingModule {}
