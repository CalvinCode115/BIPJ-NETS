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
  // All 8 rewards-system routes (nets-points, send-points, point-history,
  // partner-challenges, daily-quests, weekly-quests, my-vouchers,
  // rewards-marketplace) moved into tabs-routing.module.ts, nested under
  // the 'rewards' tab, so they keep the tab bar instead of replacing the
  // whole tabs shell. Removed from here on purpose — don't re-add them.
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}