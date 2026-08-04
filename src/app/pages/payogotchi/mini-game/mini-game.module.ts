import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MiniGamePage } from './mini-game.page';
import { MiniGamePageRoutingModule } from './mini-game-routing.module';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, MiniGamePageRoutingModule, SharedModule],
  declarations: [MiniGamePage],
})
export class MiniGamePageModule {}
