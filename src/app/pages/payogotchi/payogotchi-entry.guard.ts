import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { PetService } from '../../services/pet.service';

// Redirects the tab root: onboarded users to Home, new users to intro -> egg -> hatch.
// Awaits syncFromCloud() first so the decision uses this account's saved pet.
export const payogotchiEntryGuard: CanActivateFn = async (): Promise<UrlTree> => {
  const router = inject(Router);
  const pet = inject(PetService);
  await pet.syncFromCloud();
  const target = pet.state.onboarded
    ? '/tabs/payogotchi/payogotchi-home'
    : '/tabs/payogotchi/intro';
  return router.createUrlTree([target]);
};
