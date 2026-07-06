import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AiInsightsPageRoutingModule } from './home-ai-insights-routing.module';
import { AiInsightsPage } from './home-ai-insights.page';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [IonicModule, CommonModule, FormsModule, AiInsightsPageRoutingModule, SharedModule],
  declarations: [AiInsightsPage],
})
export class AiInsightsPageModule {}
