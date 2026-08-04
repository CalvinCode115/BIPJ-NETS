import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TransactionFeedbackPage } from './transaction-feedback.page';

const routes: Routes = [{ path: '', component: TransactionFeedbackPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TransactionFeedbackPageRoutingModule {}
