import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { PetService } from '../../services/pet.service';

// Decides where the Payogotchi tab should land. If the user already
// finished onboarding they go straight to Home, otherwise they get
// sent into the intro -> egg -> hatch flow.
//
// The tab root never shows a screen by itself - it always redirects
// based on the pet's state, so users can't end up somewhere they
// shouldn't be.
//
// We await syncFromCloud() first so the decision uses THIS user's pet
// from Firestore: a returning user (e.g. Alex) never flashes the intro,
// and a brand-new account correctly starts the intro -> egg flow.
export const payogotchiEntryGuard: CanActivateFn = async (): Promise<UrlTree> => {
  const router = inject(Router);
  const pet = inject(PetService);
  await pet.syncFromCloud();
  const target = pet.state.onboarded
    ? '/tabs/payogotchi/payogotchi-home'
    : '/tabs/payogotchi/intro';
  return router.createUrlTree([target]);
};
