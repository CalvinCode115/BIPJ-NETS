import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HowPayogotchiWorksPage } from './how-payogotchi-works.page';

const routes: Routes = [{ path: '', component: HowPayogotchiWorksPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class HowPayogotchiWorksPageRoutingModule {}
