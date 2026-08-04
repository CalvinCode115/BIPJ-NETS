import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EggReselectionTrialPage } from './egg-reselection-trial.page';

const routes: Routes = [{ path: '', component: EggReselectionTrialPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class EggReselectionTrialPageRoutingModule {}
