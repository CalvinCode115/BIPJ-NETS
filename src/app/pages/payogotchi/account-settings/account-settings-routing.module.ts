import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AccountSettingsPage } from './account-settings.page';

const routes: Routes = [{ path: '', component: AccountSettingsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class AccountSettingsPageRoutingModule {}
