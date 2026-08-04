---
name: payogotchi-phase1-persistence
description: Payogotchi PetService now persists to localStorage and applyTransaction returns TransactionResult
metadata:
  type: project
---

Phase 1 of the demo-prep spec is done in `src/app/services/pet.service.ts` + `src/app/models/pet.model.ts`:

- **localStorage persistence** under key `payogotchi_pet`. `load()` runs in the constructor and `Object.assign`s saved data over defaults (new fields survive old saves). `save()` is called after every mutation.
- **`PetState` gained:** `netsPoints`, `selectedEgg`, `lastFedAt`, `faintedAt`, `lastDecayAt`, `dailyXpEarned`, `dailyXpDate`, `onboarded`.
- **`applyTransaction(amount, category, merchant?)` returns `TransactionResult`** (xpGained, xpCapped, hungerRestored, happinessGained, pointsEarned, leveledUp/newLevel, evolved/newStage, revived). Rules: <$0.50 → 0 XP; per-txn cap 250; stage daily XP cap (Baby 200/Teen 400/Adult 600); NETS points = 10% base XP; food revives a fainted pet to ≥50 hunger. `merchant` param is accepted but unused (hook for the future bridge).

**Phase 2 is now done:** the celebration chain lives as inline `<ion-modal>`s in `payogotchi-home.page` (`showFeedback`/`showLevelUp`/`showEvolution`), driven off the `TransactionResult`. `runTransaction()` opens Feedback (always); `(didDismiss)` handlers chain Feedback → Level Up (if `leveledUp`) → Evolution (if `evolved`). The Home "Level Up"/"Evolve" demo buttons now open those modals directly with synthetic data. The old route-pages (`level-up`, `stage-evolution`, `transaction-feedback`) remain but are now redundant. See [[payogotchi-demo-flow]].