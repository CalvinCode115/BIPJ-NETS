import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';
import { HomePageRoutingModule } from './home-routing.module';
import { SharedModule } from '../../../shared/shared.module';
import { HomeRewardsCardComponent } from '../components/home-rewards-card/home-rewards-card.component';
import { HomeRecentTransactionsComponent } from '../components/home-recent-transactions/home-recent-transactions.component';
import { HomeSpendingSummaryComponent } from '../components/home-spending-summary/home-spending-summary.component';
import { HomeCurrenciesComponent } from '../components/home-currencies/home-currencies.component';
import { HomeAddCardModalComponent } from '../components/home-add-card-modal/home-add-card-modal.component';
import { HomeTopUpModalComponent } from '../components/home-top-up-modal/home-top-up-modal.component';
import { HomeNotificationsModalComponent } from '../components/home-notifications-modal/home-notifications-modal.component';
import { HomeCardCarouselComponent } from '../components/home-card-carousel/home-card-carousel.component';
import { HomeInsightCardComponent } from '../components/home-insight-card/home-insight-card.component';
import { HomeQuickActionsComponent } from '../components/home-quick-actions/home-quick-actions.component';
import { HomeSecondaryActionsComponent } from '../components/home-secondary-actions/home-secondary-actions.component';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    HomePageRoutingModule,
    SharedModule,
  ],
  declarations: [
    HomePage,
    HomeRewardsCardComponent,
    HomeRecentTransactionsComponent,
    HomeSpendingSummaryComponent,
    HomeCurrenciesComponent,
    HomeAddCardModalComponent,
    HomeTopUpModalComponent,
    HomeNotificationsModalComponent,
    HomeCardCarouselComponent,
    HomeInsightCardComponent,
    HomeQuickActionsComponent,
    HomeSecondaryActionsComponent,
  ]
})
export class HomePageModule {}
