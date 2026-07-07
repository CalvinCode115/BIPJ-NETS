import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LevelUpPage } from './level-up.page';

const routes: Routes = [{ path: '', component: LevelUpPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class LevelUpPageRoutingModule {}
