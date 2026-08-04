import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WelcomeBackPage } from './welcome-back.page';

const routes: Routes = [{ path: '', component: WelcomeBackPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class WelcomeBackPageRoutingModule {}
