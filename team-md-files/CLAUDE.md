I'm building the Egg Selection screen for my Payogotchi 
feature. Here's the Figma design:

Implement this design from Figma.
@https://www.figma.com/design/ZtD7NgqXMQFimh9BJjCaBQ/240311c-s-team-library?node-id=4781-429&m=dev 

IMPORTANT CONTEXT:
- This project uses Ionic 8 with Angular (standalone 
  components), not React or Tailwind
- SCSS for styling, not CSS-in-JS
- The page should be created at src/app/pages/egg-selection/
- Use existing SCSS variables from src/theme/variables.scss
- Reuse the existing TapatchiComponent at 
  src/app/components/tapatchi/ if the pet is shown
- Follow Ionic 8 conventions (ion-header, ion-content, 
  ion-toolbar, etc.)

Please:
1. Use get_design_context to read the frame structure
2. Use get_screenshot to see the visual reference
3. Generate the complete Ionic Angular page with:
   - .ts file (standalone component with proper imports)
   - .html file (using Ionic components)
   - .scss file (using existing theme variables)
4. Include navigation logic to move to the next screen 
   when an egg is selected
5. Do NOT output React or Tailwind — translate everything 
   to Ionic + Angular + SCSS

Save the files but let me review before creating routes.

# PAYOGOTCHI — DEMO-PREP BUILD SPEC

> **Read this before writing any code.** This is the working spec for finishing the Payogotchi
> core loop ahead of the demo. It assumes the project context in `CLAUDE.md` is already known
> (Ionic 8 + Angular, standalone/NgModule mix, SCSS with `src/theme/variables.scss`, no React,
> no Tailwind). This file focuses on **what to build, in what order, and why** — not project setup.

---

## 0. HARD CONSTRAINTS (do not violate)

- **Deadline is Thursday.** Two working days. Scope is ruthless on purpose.
- **Do NOT attempt Firestore integration unless every item in Phase 1–3 is done and tested.**
  localStorage is the persistence layer for the demo. Firestore is a designed-but-deferred story.
- **Do NOT touch teammates' code.** Off-limits: anything under `src/app/pages/home`, `pay`,
  `travel`, and the shared services (`transactions.service.ts`, `auth.service.ts`,
  `cards.service.ts`, `transfers.service.ts`, `qr-payments.service.ts`, etc.).
- **Do NOT modify `TransactionsService`.** If a bridge to it is needed, write a NEW adapter file.
- **Only `PetService` is ours.** It is the single source of truth for all pet state.
- **Colours come from `src/theme/variables.scss`.** Never hardcode hex.
- **Show the plan / show the diff before creating or overwriting files.**

---

## 1. CURRENT STATE (as of last session)

### Services
- `pet.service.ts` — **OURS.** In-memory, `providedIn: 'root'`. Holds all pet state + game logic.
  Currently has **zero** connection to `TransactionsService`.
- `transactions.service.ts` — **SHARED (NETS side).** HTTP-backed, returns `TransactionRecord`
  objects with `merchant`, `amount`, `type: 'debit' | 'credit'`, and `category: string`.
  **That `category` string is the bridge** to our `TxnCategory`.

### Pet model (current)
`PetState`: `name`, `level`, `stage`, `xp`, `xpMax`, `happiness`, `hunger`
`PetStage`: `Baby | Teen | Adult`
`TxnCategory`: `food | shopping | transport | other`
Current demo state: **Level 8 Baby, 470/800 XP, happiness 85, hunger 80.**

### Game logic already implemented in `PetService`
| Rule | Implementation |
|---|---|
| XP = amount × 10 × happiness multiplier | `applyTransaction()` |
| Happiness multiplier (1.2 / 1.0 / 0.8 / 0.5) | `happinessMultiplier` |
| Level-up rollover, `xpMax = level × 100` | `addXp()` |
| Stage thresholds (16 → Teen, 36 → Adult) | `refreshStage()` |
| Food restores hunger, capped 40/txn | `Math.min(amount * 2, 40)` |
| Mood derived from hunger + happiness | `get mood()` |
| Feed / play mutations | `feed()`, `play()` |

### Screens: 14 built, 7 scaffolds
**Built & wired to PetService:** 04 Naming, 05 Home, 07 Level Up, 08 Evolution,
09 Mini-Game, 10 Pet Settings, 13 Fainted, 15 Tutorial, 20 Rename.
**Built, not state-connected:** 01 Egg Selection, 02 Hatching Progress, 03 Hatching Animation,
17 How It Works, 21 Account Settings.
**Still scaffolds:** 06 Transaction Feedback, 11 Egg Reselection Trial, 12 Egg Reselection Penalty,
14 Welcome Back, 16 Cosmetics Dressup, 18 Cosmetic Purchase, 19 Egg Swap.

---

## 2. CANONICAL GAME LOGIC (the single source of truth)

Implement to THIS table. ✅ = done, ❌ = missing, ⚠️ = partial.

### XP & Levelling
| Rule | Value | Status |
|---|---|---|
| Base XP | amount × 10 | ✅ |
| Happiness multiplier | 1.2 (80–100) / 1.0 (50–79) / 0.8 (20–49) / 0.5 (0–19) | ✅ |
| Level threshold | `xpMax = level × 100` | ✅ |
| Stage thresholds | Baby 1–15, Teen 16–35, Adult 36+ | ✅ |
| **Daily XP cap** | Baby 200 / Teen 400 / Adult 600 | ❌ ADD |
| **Per-transaction XP cap** | 250 max | ❌ ADD |
| **Minimum transaction** | < $0.50 earns 0 XP | ❌ ADD |

### Hunger
| Rule | Value | Status |
|---|---|---|
| Restore | food category only, `amount × 2`, capped 40 | ✅ |
| **Daily decay** | Baby −10 / Teen −15 / Adult −20 | ❌ ADD |
| **Faint condition** | hunger 0 for 3 consecutive days | ❌ ADD |
| Revive | any food txn, restores hunger to 50 | ⚠️ demo button only |

### Happiness
| Rule | Value | Status |
|---|---|---|
| **Daily decay** | −5/day all stages | ❌ ADD |
| Mini-game boost | +10, max 3/day | ⚠️ no daily cap |
| New merchant category | +10 | ❌ (defer — not core) |
| Daily login | +5 | ❌ (defer — not core) |

### Currency
| Rule | Value | Status |
|---|---|---|
| NETS Points earned | 10% of base XP per txn | ❌ ADD (`netsPoints` not on model) |

---

## 3. MODEL CHANGES REQUIRED

Add these fields to `PetState`:

```ts
netsPoints: number;        // referenced all over the UI, absent from model
selectedEgg: string;       // e.g. 'pink' — chosen egg must reach PetState
lastFedAt: number | null;  // epoch ms, for faint logic
faintedAt: number | null;  // epoch ms, null unless fainted
lastDecayAt: number;       // epoch ms, last time decay was applied
dailyXpEarned: number;     // resets each calendar day
dailyXpDate: string;       // 'YYYY-MM-DD' the daily counter belongs to
```

Keep `PetStage` and `TxnCategory` as-is.

---

## 4. THE TRANSACTION PIPELINE (highest-leverage work)

### 4.1 Refactor `applyTransaction()` to RETURN a result

Currently it mutates and returns nothing. Change signature to return a `TransactionResult`
so callers can orchestrate the celebration chain.

```ts
interface TransactionResult {
  xpGained: number;
  xpCapped: boolean;       // true if daily cap was hit
  hungerRestored: number;
  happinessGained: number;
  pointsEarned: number;
  leveledUp: boolean;
  newLevel?: number;
  evolved: boolean;
  newStage?: PetStage;
  revived: boolean;        // was fainted, now awake
}
```

Inside `applyTransaction(amount, category, merchant?)`:
1. If `amount < 0.50` → return a zeroed result (no XP).
2. Compute base XP = `amount * 10`, clamp per-txn to 250.
3. Apply happiness multiplier.
4. Enforce daily XP cap: if `dailyXpDate !== today`, reset `dailyXpEarned` and set date.
   Clamp so `dailyXpEarned` never exceeds the stage cap. Set `xpCapped` accordingly.
5. If `category === 'food'`: restore hunger (`min(amount*2, 40)`), set `lastFedAt = now`.
   If pet was fainted → clear `faintedAt`, set `revived = true`, hunger to at least 50.
6. Earn NETS points = 10% of base XP.
7. `addXp()` → detect level-up and stage change, populate result fields.
8. `save()` to localStorage.
9. Return the fully populated result.

### 4.2 Caller orchestration (in Home, after a transaction)

```
const r = petService.applyTransaction(amount, category, merchant);
if (r.revived)   → present Welcome Back overlay (14)
present Transaction Feedback modal (06)          // always
if (r.leveledUp) → present Level Up modal (07)   // after feedback dismisses
if (r.evolved)   → present Stage Evolution modal (08) // after level up dismisses
```

This single refactor unlocks screens **06, 07, 08, and 14** through real game events
instead of demo buttons.

### 4.3 Bridge to Junjie's `TransactionsService` (ONLY if Phase 1–3 done + category values known)

Write a NEW file `pet-transaction-bridge.service.ts`. Do not modify `TransactionsService`.
- Subscribe to / poll the transaction stream.
- Map `TransactionRecord.category` (string) → our `TxnCategory`.
- Filter: only `type === 'debit'` counts.
- Dedupe by transaction id (so refresh doesn't double-count).
- Call `petService.applyTransaction()`.

**Category mapping — CONFIRM EXACT STRINGS WITH JUNJIE BEFORE CODING:**
```
food      ← 'F&B' | 'Food' | 'Restaurant' | 'Hawker' | ...
shopping  ← 'Retail' | 'Shopping' | 'Groceries' | ...
transport ← 'Transport' | 'Transit' | 'Grab' | ...
other     ← everything else (default)
```

---

## 5. ARCHITECTURE FIX — the lecturer's question

**The problem is NOT "no modals."** It's that routes are **unguarded** — a user can type
`/tabs/payogotchi/naming` and reach a "name your hatched pet" screen with no pet. That's a
**state** problem, and modals don't fix it. Guards do. Split screens into three categories:

### Category A — Guarded flow steps (stay as pages, ADD an `OnboardingGuard`)
Egg Selection → Hatching Progress → Hatching Animation → Naming → Home.

```
/hatching-progress   CanActivate: no selectedEgg → redirect /egg-selection
/hatching-animation  CanActivate: transactionCount < 5 → redirect /hatching-progress
/naming              CanActivate: already named → /home ; not hatched → /egg-selection
/home                CanActivate: no pet → /egg-selection
```
One guard file (~40 lines). This is the professional answer to the lecturer.

### Category B — Genuine overlays (convert to `ion-modal`, drop their routes)
- 06 Transaction Feedback — over Home
- 07 Level Up — over Home
- 08 Stage Evolution — over Home
- 18 Cosmetic Purchase — over Cosmetics
- 19 Egg Swap Confirm — over Reselection

The wider app already uses `ion-modal` heavily (pay, home, travel) with shared styling in
`global.scss`. Follow that house convention.

### Category C — States, not screens (conditional render, delete the route)
- 13 Fainted Pet → a **conditional layout of Home** when `hunger === 0 && daysSinceFed >= 3`.
- 14 Welcome Back → a **transition overlay** fired on return/revive, not a destination.

### What to tell the lecturer
> "The routes were unguarded. I split screens into three categories: guarded flow steps using
> Angular route guards to enforce onboarding order, genuine overlays that are now `ion-modal`
> components, and states like the fainted pet which shouldn't be routes at all — they're
> conditional renders of Home driven by pet state."

---

## 6. PERSISTENCE — localStorage now, Firestore as the story

Firestore by Thursday is too risky (auth wiring, rules, schema, offline, error states).
Do localStorage:

```
PetService.save()  → localStorage.setItem('payogotchi_pet', JSON.stringify(state))
PetService.load()  → parse on construction; fall back to a fresh pet on miss/parse-error
call save() after EVERY mutation (applyTransaction, feed, play, setName, decay, revive…)
```

~30 lines. Pet survives refresh; demo survives an accidental F5.

**Presentation framing (honest):**
> "State persists locally now. The Firestore schema is designed —
> `users/{uid}/payogotchi/{petId}` holding level, xp, hunger, happiness, netsPoints, lastFedAt,
> and cosmetics inventory. The service layer is abstracted so swapping the storage adapter
> touches zero screen code."

If (and only if) everything else is done and tested, add a Firestore adapter behind the same
save/load interface.

---

## 7. TIME-BASED DECAY (+ the demo trick that makes it visible)

Real decay happens over days; a demo happens in minutes. Solve both:

- Store `lastDecayAt`. On app load (and after the demo button), compute
  `elapsedDays = floor((now - lastDecayAt) / ONE_DAY)`.
- Apply retroactively: hunger −(stageRate × elapsedDays), happiness −(5 × elapsedDays),
  clamped at 0. Then check the faint condition (0 hunger for ≥3 days).
- Update `lastDecayAt`.

**Demo button "Simulate 1 day passing":** subtract `ONE_DAY` from `lastDecayAt` (and adjust
`lastFedAt`) then re-run decay. Lets you show hunger dropping → pet saddening → fainting →
reviving in ~30 seconds instead of 3 real days. This is the demo money-shot for the care loop.

---

## 8. BUILD ORDER (strict priority — stop when time runs out, demo still works)

### Phase 1 — Foundations (do first; everything depends on these)
1. **localStorage persistence** (~45 min) — demo safety, non-negotiable.
2. **Add missing `PetState` fields** (Section 3) (~30 min).
3. **Refactor `applyTransaction()` → `TransactionResult`** + daily XP cap (Section 4.1) (~1 hr).

### Phase 2 — The core loop becomes real
4. **06 Transaction Feedback as `ion-modal`** over Home, wired to the result (~1.5 hr).
5. **07 Level Up + 08 Evolution as modals**, chained off the result object (~2 hr). ← money shot.

### Phase 3 — Correctness + the lecturer's answer
6. **`OnboardingGuard`** (Section 5, Category A) (~1 hr).
7. **Home renders fainted state conditionally**; delete route to 13 (~1 hr).
8. **"Simulate 1 day passing" demo button + decay** (Section 7) (~1.5 hr).

### Phase 4 — Only if everything above is done AND tested
9. **Junjie transaction bridge** (Section 4.3) — needs his category strings + stable API.
10. **Firestore adapter** behind the same save/load interface.

### Explicitly CUT for Thursday
- Cosmetics (16, 18), Egg reselection (11, 12, 19), happiness boosters beyond mini-game.
  Leave them as scaffolds. Do not spend demo-week hours here.

---

## 9. TARGET DEMO NARRATIVE (what the above enables)

1. Fresh user picks an egg — *guard blocks skipping ahead (mention this to examiner).*
2. Transactions → egg hatches → name the pet.
3. Land on Home, live meters.
4. Food transaction → **feedback modal fires automatically → level-up modal chains after it.**
5. Hit "simulate a day" ×3 → hunger drains, pet visibly saddens, then **faints.**
6. Food transaction → **Welcome Back overlay**, pet revives.
7. **Refresh the browser → pet state is still there.**
8. Close on the architecture slide: transaction-bridge design + Firestore schema.

---

## 10. FIRST TASK FOR THIS SESSION

Start with **Phase 1, items 1–3 together**, since the model fields and the `TransactionResult`
refactor are interdependent and both need `save()` calls. Show the proposed `PetState` diff and
the new `applyTransaction()` signature BEFORE editing files. Do not proceed to Phase 2 until
persistence is verified by refreshing the browser and confirming state survives.

---

## 11. PROGRESS UPDATE — 23 Jul 2026

> Appended log of what is DONE vs REMAINING, verified against the code. Sections 1–10 above are
> kept as-is for reference; where they conflict, this section is current.

### ✅ Phase 1 — Foundations (DONE)
1. **localStorage persistence** — `PetService.save()` / `load()` on key `payogotchi_pet`;
   state merges over defaults on rehydrate so new fields survive old payloads.
2. **`PetState` fields added** — `netsPoints`, `selectedEgg`, `lastFedAt`, `faintedAt`,
   `lastDecayAt`, `dailyXpEarned`, `dailyXpDate`, plus an extra `onboarded` flag used by the
   entry guard.
3. **`applyTransaction()` → `TransactionResult`** — implemented per §4.1: min-txn $0.50,
   per-txn XP cap 250, happiness multiplier, stage-based daily XP cap with calendar reset,
   food → hunger restore + revive, NETS points = 10% of base XP, level-up/evolution detection.

### ✅ Phase 2 — Core loop (DONE)
4. **06 Transaction Feedback** — inline modal over Home, driven by the real `TransactionResult`
   (`showFeedback` + `onFeedbackDismiss`). Daily-cap hit surfaces as a top toast instead.
5. **07 Level Up + 08 Evolution** — chained modals off the result object:
   feedback dismiss → level-up → evolution. Manual demo triggers (`openLevelUp`, `openEvolve`)
   also exist for showing them on cue.

### ✅ New since the spec was written
- **00 Payogotchi Intro page** (`payogotchi-intro/`) — new-user feature introduction.
- **`payogotchiEntryGuard`** (`src/app/payogotchi/payogotchi-entry.guard.ts`) — the tab root
  never renders directly; it redirects onboarded users to Home and new users to Intro based on
  pet state. This is the first slice of the §5 guarded-routes answer.
- **Demo scenario helpers** in `PetService`: `resetNewUser()`, `seedReturningUser()`
  (Level 9 Baby at 780/900 XP with today's cap maxed), `resetDailyXpCap()`.
- **14 Welcome Back — BUILT (this session)** from Figma node 4786-5885:
  lemon→mint gradient, falling pastel confetti, pet in warm halo card with speech bubble
  ("Yay! You're back! 💕"), Welcome Back Bonus card (+200 XP / +50 NETS), red gradient
  "Continue Playing 🚀" CTA. Reuses `TapatchiComponent` (mood `excited`) via `SharedModule`;
  all colours from `variables.scss`. Home now routes to it automatically when
  `TransactionResult.revived` is true (§4.2), replacing the feedback chain for that txn.

### ❌ REMAINING (in priority order)
6. **Full `OnboardingGuard` chain (§5 Category A)** — only the tab-root entry guard exists.
   Still need per-step guards for `/hatching-progress`, `/hatching-animation`, `/naming`,
   `/home` (selectedEgg / transactionCount / named checks).
7. **Fainted state as conditional Home render (§5 Category C)** — 13 Fainted Pet is still a
   routed page (`openFaint()` navigates to it). Move to a conditional layout of Home when
   `hunger === 0 && daysSinceFed >= 3`, then delete the route.
8. **Time-based decay + "Simulate 1 day passing" button (§7)** — `lastDecayAt` is on the model
   but NO decay logic exists in `PetService` yet. This is the demo money-shot for the care loop
   (hunger drains → pet saddens → faints → food revives → Welcome Back fires).
9. **Welcome Back as a true overlay** — it is built and state-triggered, but still lives on a
   route (`/welcome-back`). §5 Category C says it should eventually be a transition overlay;
   acceptable for the demo since it now only fires off `revived`, refine if time allows.
10. **Phase 4 (only after 6–8 are done + tested)** — Junjie transaction bridge
    (`pet-transaction-bridge.service.ts`, confirm category strings first) and the Firestore
    adapter behind the same save/load interface.

### Explicitly still CUT
- Cosmetics (16, 18), Egg reselection (11, 12, 19) remain scaffolds — unchanged.