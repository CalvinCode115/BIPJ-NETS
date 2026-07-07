import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CosmeticsDressupPage } from './cosmetics-dressup.page';
import { CosmeticsDressupPageRoutingModule } from './cosmetics-dressup-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CosmeticsDressupPageRoutingModule],
  declarations: [CosmeticsDressupPage],
})
export class CosmeticsDressupPageModule {}
