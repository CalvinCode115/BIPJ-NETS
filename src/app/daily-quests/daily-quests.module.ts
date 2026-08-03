import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DailyQuestsPageRoutingModule } from './daily-quests-routing.module';

import { DailyQuestsPage } from './daily-quests.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DailyQuestsPageRoutingModule
  ],
  declarations: [DailyQuestsPage]
})
export class DailyQuestsPageModule {}
