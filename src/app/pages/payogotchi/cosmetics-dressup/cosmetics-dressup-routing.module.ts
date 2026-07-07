import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CosmeticsDressupPage } from './cosmetics-dressup.page';

const routes: Routes = [{ path: '', component: CosmeticsDressupPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class CosmeticsDressupPageRoutingModule {}
