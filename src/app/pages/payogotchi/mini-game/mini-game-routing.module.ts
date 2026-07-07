import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MiniGamePage } from './mini-game.page';

const routes: Routes = [{ path: '', component: MiniGamePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class MiniGamePageRoutingModule {}
