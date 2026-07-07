import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EggSwapModalPage } from './egg-swap-modal.page';

const routes: Routes = [{ path: '', component: EggSwapModalPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class EggSwapModalPageRoutingModule {}
