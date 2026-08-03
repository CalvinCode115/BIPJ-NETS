import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WeeklyQuestsPageRoutingModule } from './weekly-quests-routing.module';

import { WeeklyQuestsPage } from './weekly-quests.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WeeklyQuestsPageRoutingModule
  ],
  declarations: [WeeklyQuestsPage]
})
export class WeeklyQuestsPageModule {}
