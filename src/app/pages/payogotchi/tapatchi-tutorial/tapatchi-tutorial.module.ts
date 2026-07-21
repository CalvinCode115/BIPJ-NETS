import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TapatchiTutorialPage } from './tapatchi-tutorial.page';
import { TapatchiTutorialPageRoutingModule } from './tapatchi-tutorial-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TapatchiTutorialPageRoutingModule, SharedModule],
  declarations: [TapatchiTutorialPage],
})
export class TapatchiTutorialPageModule {}
