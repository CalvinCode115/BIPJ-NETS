import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PayogotchiPage } from './payogotchi.page';

const routes: Routes = [
  { path: '', component: PayogotchiPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PayogotchiPageRoutingModule {}
