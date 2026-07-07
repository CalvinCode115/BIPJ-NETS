import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EggReselectionPenaltyPage } from './egg-reselection-penalty.page';
import { EggReselectionPenaltyPageRoutingModule } from './egg-reselection-penalty-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, EggReselectionPenaltyPageRoutingModule],
  declarations: [EggReselectionPenaltyPage],
})
export class EggReselectionPenaltyPageModule {}
