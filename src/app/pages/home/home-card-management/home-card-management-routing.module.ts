import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CardManagementPage } from './home-card-management.page';

const routes: Routes = [
  {
    path: '',
    component: CardManagementPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CardManagementPageRoutingModule {}
