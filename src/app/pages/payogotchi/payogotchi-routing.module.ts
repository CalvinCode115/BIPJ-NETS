import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PayogotchiPage } from './payogotchi.page';
import { payogotchiEntryGuard } from './payogotchi-entry.guard';

const routes: Routes = [
  // Tab landing: the guard redirects to Home (returning user) or Intro (new
  // user) based on pet state — it never actually renders PayogotchiPage.
  { path: '', canActivate: [payogotchiEntryGuard], component: PayogotchiPage },

  // Tapatchi component test page (kept for development).
  { path: 'dev', component: PayogotchiPage },

  {
    path: 'intro', // 00 — new-user "NETS new feature" introduction
    loadChildren: () =>
      import('./payogotchi-intro/payogotchi-intro.module').then(
        (m) => m.PayogotchiIntroPageModule
      ),
  },

  // ---- Payogotchi onboarding + game screens (see overview.md) ----
  {
    path: 'egg-selection', // 01
    loadChildren: () =>
      import('./egg-selection/egg-selection.module').then(
        (m) => m.EggSelectionPageModule
      ),
  },
  {
    path: 'hatching-progress', // 02
    loadChildren: () =>
      import('./hatching-progress/hatching-progress.module').then(
        (m) => m.HatchingProgressPageModule
      ),
  },
  {
    path: 'hatching-animation', // 03
    loadChildren: () =>
      import('./hatching-animation/hatching-animation.module').then(
        (m) => m.HatchingAnimationPageModule
      ),
  },
  {
    path: 'naming-screen', // 04
    loadChildren: () =>
      import('./naming-screen/naming-screen.module').then(
        (m) => m.NamingScreenPageModule
      ),
  },
  {
    path: 'payogotchi-home', // 05
    loadChildren: () =>
      import('./payogotchi-home/payogotchi-home.module').then(
        (m) => m.PayogotchiHomePageModule
      ),
  },
  {
    path: 'transaction-feedback', // 06
    loadChildren: () =>
      import('./transaction-feedback/transaction-feedback.module').then(
        (m) => m.TransactionFeedbackPageModule
      ),
  },
  {
    path: 'level-up', // 07
    loadChildren: () =>
      import('./level-up/level-up.module').then(
        (m) => m.LevelUpPageModule
      ),
  },
  {
    path: 'stage-evolution', // 08
    loadChildren: () =>
      import('./stage-evolution/stage-evolution.module').then(
        (m) => m.StageEvolutionPageModule
      ),
  },
  {
    path: 'mini-game', // 09
    loadChildren: () =>
      import('./mini-game/mini-game.module').then(
        (m) => m.MiniGamePageModule
      ),
  },
  {
    path: 'pet-settings', // 10
    loadChildren: () =>
      import('./pet-settings/pet-settings.module').then(
        (m) => m.PetSettingsPageModule
      ),
  },
  {
    path: 'egg-reselection-trial', // 11
    loadChildren: () =>
      import('./egg-reselection-trial/egg-reselection-trial.module').then(
        (m) => m.EggReselectionTrialPageModule
      ),
  },
  {
    path: 'egg-reselection-penalty', // 12
    loadChildren: () =>
      import('./egg-reselection-penalty/egg-reselection-penalty.module').then(
        (m) => m.EggReselectionPenaltyPageModule
      ),
  },
  {
    path: 'fainted-pet', // 13
    loadChildren: () =>
      import('./fainted-pet/fainted-pet.module').then(
        (m) => m.FaintedPetPageModule
      ),
  },
  {
    path: 'welcome-back', // 14
    loadChildren: () =>
      import('./welcome-back/welcome-back.module').then(
        (m) => m.WelcomeBackPageModule
      ),
  },
  {
    path: 'tapatchi-tutorial', // 15
    loadChildren: () =>
      import('./tapatchi-tutorial/tapatchi-tutorial.module').then(
        (m) => m.TapatchiTutorialPageModule
      ),
  },
  {
    path: 'cosmetics-dressup', // 16
    loadChildren: () =>
      import('./cosmetics-dressup/cosmetics-dressup.module').then(
        (m) => m.CosmeticsDressupPageModule
      ),
  },
  {
    path: 'how-payogotchi-works', // 17
    loadChildren: () =>
      import('./how-payogotchi-works/how-payogotchi-works.module').then(
        (m) => m.HowPayogotchiWorksPageModule
      ),
  },
  {
    path: 'cosmetic-purchase-modal', // 18
    loadChildren: () =>
      import('./cosmetic-purchase-modal/cosmetic-purchase-modal.module').then(
        (m) => m.CosmeticPurchaseModalPageModule
      ),
  },
  {
    path: 'egg-swap-modal', // 19
    loadChildren: () =>
      import('./egg-swap-modal/egg-swap-modal.module').then(
        (m) => m.EggSwapModalPageModule
      ),
  },
  {
    path: 'rename-pet', // 20
    loadChildren: () =>
      import('./rename-pet/rename-pet.module').then(
        (m) => m.RenamePetPageModule
      ),
  },
  {
    path: 'account-settings', // 21
    loadChildren: () =>
      import('./account-settings/account-settings.module').then(
        (m) => m.AccountSettingsPageModule
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class PayogotchiPageRoutingModule {}
