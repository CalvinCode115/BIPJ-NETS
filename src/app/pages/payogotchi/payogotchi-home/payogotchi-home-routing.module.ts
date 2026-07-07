import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PayogotchiHomePage } from './payogotchi-home.page';

const routes: Routes = [{ path: '', component: PayogotchiHomePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PayogotchiHomePageRoutingModule {}
