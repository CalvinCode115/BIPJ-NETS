import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../homepage/home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'pay',
        loadChildren: () => import('../payment/pay/pay.module').then(m => m.PayPageModule)
      },
      {
        path: 'travel',
        loadChildren: () => import('../travel/travel.module').then(m => m.TravelPageModule)
      },
      {
        path: 'fx-tracker',
        loadChildren: () => import('../fx-tracker/fx-tracker.module').then(m => m.FxTrackerPageModule)
      },
      {
        // The Rewards tab root (NETS Points) PLUS every other rewards page,
        // all nested here so they keep the tab bar. Each one keeps its own
        // lazy-loaded module — only WHERE it's registered changes, not how
        // the page itself works.
        path: 'rewards',
        children: [
          {
            path: '',
            loadChildren: () => import('../nets-points/nets-points.module').then(m => m.NetsPointsPageModule)
          },
          {
            path: 'send-points',
            loadChildren: () => import('../send-points/send-points.module').then(m => m.SendPointsPageModule)
          },
          {
            path: 'point-history',
            loadChildren: () => import('../point-history/point-history.module').then(m => m.PointHistoryPageModule)
          },
          {
            path: 'partner-challenges',
            loadChildren: () => import('../partner-challenges/partner-challenges.module').then(m => m.PartnerChallengesPageModule)
          },
          {
            path: 'daily-quests',
            loadChildren: () => import('../daily-quests/daily-quests.module').then(m => m.DailyQuestsPageModule)
          },
          {
            path: 'weekly-quests',
            loadChildren: () => import('../weekly-quests/weekly-quests.module').then(m => m.WeeklyQuestsPageModule)
          },
          {
            path: 'my-vouchers',
            loadChildren: () => import('../my-vouchers/my-vouchers.module').then(m => m.MyVouchersPageModule)
          },
          {
            path: 'rewards-marketplace',
            loadChildren: () => import('../rewards-marketplace/rewards-marketplace.module').then(m => m.RewardsMarketplacePageModule)
          },
        ]
      },
      {
        path: 'payogotchi',
        loadChildren: () => import('../payogotchi/payogotchi.module').then(m => m.PayogotchiPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}