import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RenamePetPage } from './rename-pet.page';

const routes: Routes = [{ path: '', component: RenamePetPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class RenamePetPageRoutingModule {}
