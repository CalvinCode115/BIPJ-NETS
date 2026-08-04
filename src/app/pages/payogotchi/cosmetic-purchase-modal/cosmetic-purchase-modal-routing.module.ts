import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CosmeticPurchaseModalPage } from './cosmetic-purchase-modal.page';

const routes: Routes = [{ path: '', component: CosmeticPurchaseModalPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class CosmeticPurchaseModalPageRoutingModule {}
