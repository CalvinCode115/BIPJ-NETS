import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HatchingAnimationPage } from './hatching-animation.page';

const routes: Routes = [{ path: '', component: HatchingAnimationPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class HatchingAnimationPageRoutingModule {}
