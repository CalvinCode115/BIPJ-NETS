import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { XpHistoryPage } from './xp-history.page';
import { XpHistoryPageRoutingModule } from './xp-history-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, XpHistoryPageRoutingModule, SharedModule],
  declarations: [XpHistoryPage],
})
export class XpHistoryPageModule {}
