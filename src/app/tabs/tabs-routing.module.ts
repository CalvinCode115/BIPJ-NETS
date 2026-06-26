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
        loadChildren: () => import('../home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'pay',
        loadChildren: () => import('../pay/pay.module').then(m => m.PayPageModule)
      },
      {
        path: 'travel',
        loadChildren: () => import('../travel/travel.module').then(m => m.TravelPageModule)
      },
      {
        path: 'rewards',
        loadChildren: () => import('../rewards/rewards.module').then(m => m.RewardsPageModule)
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
