import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StageEvolutionPage } from './stage-evolution.page';
import { StageEvolutionPageRoutingModule } from './stage-evolution-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, StageEvolutionPageRoutingModule, SharedModule],
  declarations: [StageEvolutionPage],
})
export class StageEvolutionPageModule {}
