import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NamingScreenPage } from './naming-screen.page';

const routes: Routes = [{ path: '', component: NamingScreenPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class NamingScreenPageRoutingModule {}
