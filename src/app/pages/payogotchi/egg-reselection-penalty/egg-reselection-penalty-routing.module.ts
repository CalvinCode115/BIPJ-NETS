import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EggReselectionPenaltyPage } from './egg-reselection-penalty.page';

const routes: Routes = [{ path: '', component: EggReselectionPenaltyPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class EggReselectionPenaltyPageRoutingModule {}
