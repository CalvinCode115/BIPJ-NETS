import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HatchingProgressPage } from './hatching-progress.page';

const routes: Routes = [{ path: '', component: HatchingProgressPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class HatchingProgressPageRoutingModule {}
