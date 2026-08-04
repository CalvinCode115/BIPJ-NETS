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
        loadChildren: () => import('../pages/home/home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'pay',
        loadChildren: () => import('../pages/pay/pay/pay.module').then(m => m.PayPageModule)
      },
      {
        path: 'travel',
        loadChildren: () => import('../pages/travel/travel.module').then(m => m.TravelPageModule)
      },
      {
        path: 'fx-tracker',
        loadChildren: () => import('../pages/travel/fx-tracker/fx-tracker.module').then(m => m.FxTrackerPageModule)
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
            loadChildren: () => import('../pages/rewards/nets-points/nets-points.module').then(m => m.NetsPointsPageModule)
          },
          {
            path: 'send-points',
            loadChildren: () => import('../pages/rewards/send-points/send-points.module').then(m => m.SendPointsPageModule)
          },
          {
            path: 'point-history',
            loadChildren: () => import('../pages/rewards/point-history/point-history.module').then(m => m.PointHistoryPageModule)
          },
          {
            path: 'partner-challenges',
            loadChildren: () => import('../pages/rewards/partner-challenges/partner-challenges.module').then(m => m.PartnerChallengesPageModule)
          },
          {
            path: 'daily-quests',
            loadChildren: () => import('../pages/rewards/daily-quests/daily-quests.module').then(m => m.DailyQuestsPageModule)
          },
          {
            path: 'weekly-quests',
            loadChildren: () => import('../pages/rewards/weekly-quests/weekly-quests.module').then(m => m.WeeklyQuestsPageModule)
          },
          {
            path: 'my-vouchers',
            loadChildren: () => import('../pages/rewards/my-vouchers/my-vouchers.module').then(m => m.MyVouchersPageModule)
          },
          {
            path: 'rewards-marketplace',
            loadChildren: () => import('../pages/rewards/rewards-marketplace/rewards-marketplace.module').then(m => m.RewardsMarketplacePageModule)
          },
        ]
      },
      {
        path: 'payogotchi',
        loadChildren: () => import('../pages/payogotchi/payogotchi.module').then(m => m.PayogotchiPageModule)
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