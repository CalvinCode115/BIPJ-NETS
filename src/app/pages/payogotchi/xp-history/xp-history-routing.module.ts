import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { XpHistoryPage } from './xp-history.page';

const routes: Routes = [{ path: '', component: XpHistoryPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class XpHistoryPageRoutingModule {}
