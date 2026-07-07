import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PeriodSelectSheetComponent } from './period-select-sheet/period-select-sheet.component';
import { NetsLogoComponent } from './nets-logo/nets-logo.component';
import { TapatchiComponent } from '../components/tapatchi/tapatchi.component';

@NgModule({
  declarations: [PeriodSelectSheetComponent, NetsLogoComponent, TapatchiComponent],
  imports: [CommonModule, IonicModule],
  exports: [PeriodSelectSheetComponent, NetsLogoComponent, TapatchiComponent],
})
export class SharedModule {}
