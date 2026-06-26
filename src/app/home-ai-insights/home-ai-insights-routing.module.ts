import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AiInsightsPage } from './home-ai-insights.page';

const routes: Routes = [
  {
    path: '',
    component: AiInsightsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AiInsightsPageRoutingModule {}
