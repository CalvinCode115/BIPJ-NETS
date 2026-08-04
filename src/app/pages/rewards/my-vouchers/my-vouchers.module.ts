import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MyVouchersPageRoutingModule } from './my-vouchers-routing.module';

import { MyVouchersPage } from './my-vouchers.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MyVouchersPageRoutingModule
  ],
  declarations: [MyVouchersPage]
})
export class MyVouchersPageModule {}
