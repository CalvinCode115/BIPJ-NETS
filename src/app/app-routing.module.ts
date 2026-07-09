import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then((m) => m.LoginPageModule),
  },
  {
    path: 'signup',
    loadChildren: () => import('./signup/signup.module').then((m) => m.SignupPageModule),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadChildren: () => import('./tabs/tabs.module').then((m) => m.TabsPageModule),
  },
  {
    path: 'nets-points',
    loadChildren: () => import('./nets-points/nets-points.module').then( m => m.NetsPointsPageModule)
  },
  {
    path: 'send-points',
    loadChildren: () => import('./send-points/send-points.module').then( m => m.SendPointsPageModule)
  },
  {
    path: 'point-history',
    loadChildren: () => import('./point-history/point-history.module').then( m => m.PointHistoryPageModule)
  },  {
    path: 'partner-challenges',
    loadChildren: () => import('./partner-challenges/partner-challenges.module').then( m => m.PartnerChallengesPageModule)
  },
  {
    path: 'daily-quests',
    loadChildren: () => import('./daily-quests/daily-quests.module').then( m => m.DailyQuestsPageModule)
  },
  {
    path: 'weekly-quests',
    loadChildren: () => import('./weekly-quests/weekly-quests.module').then( m => m.WeeklyQuestsPageModule)
  },
  {
    path: 'my-vouchers',
    loadChildren: () => import('./my-vouchers/my-vouchers.module').then( m => m.MyVouchersPageModule)
  },
  {
    path: 'rewards-marketplace',
    loadChildren: () => import('./rewards-marketplace/rewards-marketplace.module').then( m => m.RewardsMarketplacePageModule)
  },


];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
