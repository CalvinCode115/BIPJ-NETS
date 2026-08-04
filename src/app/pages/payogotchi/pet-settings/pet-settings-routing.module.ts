import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PetSettingsPage } from './pet-settings.page';

const routes: Routes = [{ path: '', component: PetSettingsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PetSettingsPageRoutingModule {}
