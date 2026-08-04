import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CosmeticPurchaseModalPage } from './cosmetic-purchase-modal.page';
import { CosmeticPurchaseModalPageRoutingModule } from './cosmetic-purchase-modal-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CosmeticPurchaseModalPageRoutingModule],
  declarations: [CosmeticPurchaseModalPage],
})
export class CosmeticPurchaseModalPageModule {}
