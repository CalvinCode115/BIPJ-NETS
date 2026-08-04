import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DailyQuestsPage } from './daily-quests.page';

const routes: Routes = [
  {
    path: '',
    component: DailyQuestsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DailyQuestsPageRoutingModule {}
