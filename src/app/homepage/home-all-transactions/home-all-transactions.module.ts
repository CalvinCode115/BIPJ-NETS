import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AllTransactionsPageRoutingModule } from './home-all-transactions-routing.module';
import { AllTransactionsPage } from './home-all-transactions.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, AllTransactionsPageRoutingModule, SharedModule],
  declarations: [AllTransactionsPage],
})
export class AllTransactionsPageModule {}
