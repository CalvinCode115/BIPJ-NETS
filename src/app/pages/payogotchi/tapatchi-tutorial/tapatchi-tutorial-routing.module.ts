import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TapatchiTutorialPage } from './tapatchi-tutorial.page';

const routes: Routes = [{ path: '', component: TapatchiTutorialPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TapatchiTutorialPageRoutingModule {}
