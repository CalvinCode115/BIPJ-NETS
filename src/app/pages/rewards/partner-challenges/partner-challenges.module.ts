import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PartnerChallengesPageRoutingModule } from './partner-challenges-routing.module';

import { PartnerChallengesPage } from './partner-challenges.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PartnerChallengesPageRoutingModule
  ],
  declarations: [PartnerChallengesPage]
})
export class PartnerChallengesPageModule {}
