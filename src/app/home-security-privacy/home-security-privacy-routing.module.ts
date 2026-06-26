import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SecurityPrivacyPage } from './home-security-privacy.page';

const routes: Routes = [
  {
    path: '',
    component: SecurityPrivacyPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SecurityPrivacyPageRoutingModule {}
