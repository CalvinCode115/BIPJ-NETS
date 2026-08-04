import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PayogotchiIntroPage } from './payogotchi-intro.page';

const routes: Routes = [{ path: '', component: PayogotchiIntroPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PayogotchiIntroPageRoutingModule {}
