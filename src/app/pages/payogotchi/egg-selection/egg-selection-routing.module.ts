import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EggSelectionPage } from './egg-selection.page';

const routes: Routes = [
  { path: '', component: EggSelectionPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class EggSelectionPageRoutingModule {}
