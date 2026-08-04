import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeAppSettingsPage } from './home-app-settings.page';

const routes: Routes = [
  {
    path: '',
    component: HomeAppSettingsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomeAppSettingsPageRoutingModule {}
