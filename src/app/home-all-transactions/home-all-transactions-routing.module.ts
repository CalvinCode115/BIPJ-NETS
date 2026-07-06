import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllTransactionsPage } from './home-all-transactions.page';

const routes: Routes = [
  {
    path: '',
    component: AllTransactionsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AllTransactionsPageRoutingModule {}
