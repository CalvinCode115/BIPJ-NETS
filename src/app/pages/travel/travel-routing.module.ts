import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TravelPage } from './travel.page';

const routes: Routes = [
  { path: '', component: TravelPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TravelPageRoutingModule {}
