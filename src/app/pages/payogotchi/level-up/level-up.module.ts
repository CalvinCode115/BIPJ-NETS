import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { LevelUpPage } from './level-up.page';
import { LevelUpPageRoutingModule } from './level-up-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, LevelUpPageRoutingModule, SharedModule],
  declarations: [LevelUpPage],
})
export class LevelUpPageModule {}
