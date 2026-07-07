import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PayogotchiPage } from './payogotchi.page';

const routes: Routes = [
  // Tab landing (currently the Tapatchi test page). Promote Payogotchi Home
  // (screen 05) to '' once that screen is built.
  { path: '', component: PayogotchiPage },

  // ---- Payogotchi onboarding + game screens (see overview.md) ----
  {
    path: 'egg-selection', // 01
    loadChildren: () =>
      import('../pages/payogotchi/egg-selection/egg-selection.module').then(
        (m) => m.EggSelectionPageModule
      ),
  },
  {
    path: 'hatching-progress', // 02
    loadChildren: () =>
      import('../pages/payogotchi/hatching-progress/hatching-progress.module').then(
        (m) => m.HatchingProgressPageModule
      ),
  },
  {
    path: 'hatching-animation', // 03
    loadChildren: () =>
      import('../pages/payogotchi/hatching-animation/hatching-animation.module').then(
        (m) => m.HatchingAnimationPageModule
      ),
  },
  {
    path: 'naming-screen', // 04
    loadChildren: () =>
      import('../pages/payogotchi/naming-screen/naming-screen.module').then(
        (m) => m.NamingScreenPageModule
      ),
  },
  {
    path: 'payogotchi-home', // 05
    loadChildren: () =>
      import('../pages/payogotchi/payogotchi-home/payogotchi-home.module').then(
        (m) => m.PayogotchiHomePageModule
      ),
  },
  {
    path: 'transaction-feedback', // 06
    loadChildren: () =>
      import('../pages/payogotchi/transaction-feedback/transaction-feedback.module').then(
        (m) => m.TransactionFeedbackPageModule
      ),
  },
  {
    path: 'level-up', // 07
    loadChildren: () =>
      import('../pages/payogotchi/level-up/level-up.module').then(
        (m) => m.LevelUpPageModule
      ),
  },
  {
    path: 'stage-evolution', // 08
    loadChildren: () =>
      import('../pages/payogotchi/stage-evolution/stage-evolution.module').then(
        (m) => m.StageEvolutionPageModule
      ),
  },
  {
    path: 'mini-game', // 09
    loadChildren: () =>
      import('../pages/payogotchi/mini-game/mini-game.module').then(
        (m) => m.MiniGamePageModule
      ),
  },
  {
    path: 'pet-settings', // 10
    loadChildren: () =>
      import('../pages/payogotchi/pet-settings/pet-settings.module').then(
        (m) => m.PetSettingsPageModule
      ),
  },
  {
    path: 'egg-reselection-trial', // 11
    loadChildren: () =>
      import('../pages/payogotchi/egg-reselection-trial/egg-reselection-trial.module').then(
        (m) => m.EggReselectionTrialPageModule
      ),
  },
  {
    path: 'egg-reselection-penalty', // 12
    loadChildren: () =>
      import('../pages/payogotchi/egg-reselection-penalty/egg-reselection-penalty.module').then(
        (m) => m.EggReselectionPenaltyPageModule
      ),
  },
  {
    path: 'fainted-pet', // 13
    loadChildren: () =>
      import('../pages/payogotchi/fainted-pet/fainted-pet.module').then(
        (m) => m.FaintedPetPageModule
      ),
  },
  {
    path: 'welcome-back', // 14
    loadChildren: () =>
      import('../pages/payogotchi/welcome-back/welcome-back.module').then(
        (m) => m.WelcomeBackPageModule
      ),
  },
  {
    path: 'tapatchi-tutorial', // 15
    loadChildren: () =>
      import('../pages/payogotchi/tapatchi-tutorial/tapatchi-tutorial.module').then(
        (m) => m.TapatchiTutorialPageModule
      ),
  },
  {
    path: 'cosmetics-dressup', // 16
    loadChildren: () =>
      import('../pages/payogotchi/cosmetics-dressup/cosmetics-dressup.module').then(
        (m) => m.CosmeticsDressupPageModule
      ),
  },
  {
    path: 'how-payogotchi-works', // 17
    loadChildren: () =>
      import('../pages/payogotchi/how-payogotchi-works/how-payogotchi-works.module').then(
        (m) => m.HowPayogotchiWorksPageModule
      ),
  },
  {
    path: 'cosmetic-purchase-modal', // 18
    loadChildren: () =>
      import('../pages/payogotchi/cosmetic-purchase-modal/cosmetic-purchase-modal.module').then(
        (m) => m.CosmeticPurchaseModalPageModule
      ),
  },
  {
    path: 'egg-swap-modal', // 19
    loadChildren: () =>
      import('../pages/payogotchi/egg-swap-modal/egg-swap-modal.module').then(
        (m) => m.EggSwapModalPageModule
      ),
  },
  {
    path: 'rename-pet', // 20
    loadChildren: () =>
      import('../pages/payogotchi/rename-pet/rename-pet.module').then(
        (m) => m.RenamePetPageModule
      ),
  },
  {
    path: 'account-settings', // 21
    loadChildren: () =>
      import('../pages/payogotchi/account-settings/account-settings.module').then(
        (m) => m.AccountSettingsPageModule
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PayogotchiPageRoutingModule {}
