---
name: payogotchi-demo-flow
description: Payogotchi demo-flow decisions — two user scenarios, entry guard, demo-driven pet (no live bridge)
metadata:
  type: project
---

Payogotchi demo (deadline Thu 2026-07-23-ish) targets two scripted scenarios, chosen by the user:

- **New user:** `/tabs/payogotchi` → `payogotchiEntryGuard` (`src/app/pages/payogotchi/payogotchi-entry.guard.ts`) sees `onboarded === false` → new `intro` screen (`pages/payogotchi/payogotchi-intro`, the "NETS new feature" drop-down animation) → egg-selection → hatching-progress → hatching-animation → naming → `completeOnboarding()` (sets `onboarded=true`) → home.
- **Returning user:** `onboarded === true` → straight to `payogotchi-home`, seeded Lv9 780/900 **already at today's XP cap** (dailyXpEarned=200). Demo story: tap → XP blocked (top cap toast via ToastController) → tap **♻️ Reset XP Cap** → tap → rolls into Level 10 with the celebration modal.

Decisions (confirmed by user):
- **Pet is demo-driven, NOT bridged to Junjie's `TransactionsService`.** Real QR payments do NOT affect the pet — only the Home demo buttons call `PetService.applyTransaction()`. The live bridge is deferred (spec Phase 4).
- **New vs returning is an `onboarded` flag** persisted in localStorage (`payogotchi_pet`), not tied to login account.
- Old test page kept at `/tabs/payogotchi/dev`; it has **"New user" / "Returning user" buttons** (`demoNewUser()`/`demoReturningUser()` → `PetService.resetNewUser()`/`seedReturningUser()`) to flip scenarios on stage.
- Home DEMO MODE section also has **♻️ Reset XP Cap** (`resetDailyXpCap()`) and **🥚 New User** (`resetNewUser()` + navigate to run intro→egg) so both demos are reachable without typing URLs. The `onboarded` guard is why egg-selection isn't directly reachable once onboarded — use New User to replay it.

**Why:** ruthless scope for a 2-day demo; reliability on stage beats live integration.
**How to apply:** drive meters via Home demo buttons during the demo; use the `/dev` page to reset between run-throughs. See [[payogotchi-phase1-persistence]].