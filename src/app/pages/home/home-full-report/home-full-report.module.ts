import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FullReportPageRoutingModule } from './home-full-report-routing.module';
import { FullReportPage } from './home-full-report.page';
import { SharedModule } from '../../../shared/shared.module';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, FullReportPageRoutingModule, SharedModule],
  declarations: [FullReportPage],
})
export class FullReportPageModule {}
