import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PeriodSelectSheetComponent } from './period-select-sheet/period-select-sheet.component';
import { NetsLogoComponent } from './nets-logo/nets-logo.component';

@NgModule({
  declarations: [PeriodSelectSheetComponent, NetsLogoComponent],
  imports: [CommonModule, IonicModule],
  exports: [PeriodSelectSheetComponent, NetsLogoComponent],
})
export class SharedModule {}
