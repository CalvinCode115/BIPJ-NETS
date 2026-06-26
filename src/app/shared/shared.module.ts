import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { PeriodSelectSheetComponent } from './period-select-sheet/period-select-sheet.component';

@NgModule({
  declarations: [PeriodSelectSheetComponent],
  imports: [CommonModule, IonicModule],
  exports: [PeriodSelectSheetComponent],
})
export class SharedModule {}
