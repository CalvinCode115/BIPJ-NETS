import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TransactionFeedbackPage } from './transaction-feedback.page';
import { TransactionFeedbackPageRoutingModule } from './transaction-feedback-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TransactionFeedbackPageRoutingModule],
  declarations: [TransactionFeedbackPage],
})
export class TransactionFeedbackPageModule {}
