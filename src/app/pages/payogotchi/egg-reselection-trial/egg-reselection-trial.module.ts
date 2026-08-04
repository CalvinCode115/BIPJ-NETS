import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EggReselectionTrialPage } from './egg-reselection-trial.page';
import { EggReselectionTrialPageRoutingModule } from './egg-reselection-trial-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, EggReselectionTrialPageRoutingModule],
  declarations: [EggReselectionTrialPage],
})
export class EggReselectionTrialPageModule {}
