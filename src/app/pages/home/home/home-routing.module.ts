import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';

const routes: Routes = [
  {
    path: '',
    component: HomePage,
  },
  {
    path: 'home-full-report',
    loadChildren: () =>
      import('../home-full-report/home-full-report.module').then((m) => m.FullReportPageModule),
  },
  {
    path: 'home-ai-insights',
    loadChildren: () =>
      import('../home-ai-insights/home-ai-insights.module').then((m) => m.AiInsightsPageModule),
  },
  {
    path: 'home-all-transactions',
    loadChildren: () =>
      import('../home-all-transactions/home-all-transactions.module').then(
        (m) => m.AllTransactionsPageModule,
      ),
  },
  {
    path: 'home-more',
    loadChildren: () => import('../home-more/home-more.module').then((m) => m.MorePageModule),
  },
  {
    path: 'home-card-management',
    loadChildren: () =>
      import('../home-card-management/home-card-management.module').then(
        (m) => m.CardManagementPageModule,
      ),
  },
  {
    path: 'home-security-privacy',
    loadChildren: () =>
      import('../home-security-privacy/home-security-privacy.module').then(
        (m) => m.SecurityPrivacyPageModule,
      ),
  },
  {
    path: 'home-notifications',
    loadChildren: () =>
      import('../home-notifications/home-notifications.module').then(
        (m) => m.HomeNotificationsPageModule,
      ),
  },
  {
    path: 'home-app-settings',
    loadChildren: () =>
      import('../home-app-settings/home-app-settings.module').then(
        (m) => m.HomeAppSettingsPageModule,
      ),
  },
  {
    path: 'home-qr-code',
    loadChildren: () =>
      import('../home-qr-code/home-qr-code.module').then((m) => m.QrCodePageModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomePageRoutingModule {}
