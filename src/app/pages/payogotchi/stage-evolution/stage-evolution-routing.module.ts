import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StageEvolutionPage } from './stage-evolution.page';

const routes: Routes = [{ path: '', component: StageEvolutionPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class StageEvolutionPageRoutingModule {}
