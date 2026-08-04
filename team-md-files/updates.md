---
name: updates
description: Dated change log of Calvin's Payogotchi work, most recent session first
metadata:
  type: project
---

# Payogotchi — Change Log

**Maintained by:** Calvin (Payogotchi / Tapatchi)
**Audience:** Teammates integrating with Payogotchi, or picking this feature back up later

---

## 2026-08-04 (3) — Bridged Payogotchi's NETS Points to Yunen's real balance

**Audience:** Yunen especially — this touches the points balance/ledger your `points.service.ts` /
`points.js` read from.

### The problem

Payogotchi had its own fake `PetState.netsPoints` counter — `applyTransaction()` invented
"10% of base XP" on every transaction and added it to a number only Payogotchi ever displayed.
Meanwhile the real points economy (`users/{userId}.points` in Firestore, 10 points per $1 spent,
`backend/services/transaction-rewards.js`) was already crediting the account for the exact same
transactions, completely independently. Two disconnected currencies both calling themselves
"NETS Points."

### The fix

Payogotchi no longer tracks its own points number at all. Instead:

- **Plain transactions earn nothing extra on Payogotchi's side** — your side already awards the
  real points for spending (unchanged, not touched).
- **NETS Points from Payogotchi now only happen for a level-up or evolution milestone**, awarded
  for real via a new backend call, and pulled from a scale that's deliberately much smaller than
  the transaction rate — meant to be a hard-to-earn bonus, not a second way to farm points:

  | Level reached | Bonus |
  |---|---|
  | 1–10 | 5 |
  | 11–20 | 10 |
  | 21–25 | 15 |
  | 26–30 | 20 |
  | 31–35 | 30 |
  | 36–40 | 40 |
  | 41–49 | 50 |
  | 50 (current final level) | 100 |

  Evolving (Baby→Teen, Teen→Adult) is a flat **+100**.

- **Payogotchi Home's "Total Activity → NETS Points" now reads your real balance** via
  `PointsService.getBalance()` — the same number the NETS Points page shows — instead of the old
  fake counter.

### New backend piece (new file, doesn't touch any of your existing files)

- `backend/services/payogotchi-rewards.js` — `awardPetMilestone(userId, { fromLevel, toLevel,
  evolved, newStage })`. Same get→add→write-ledger-entry shape as your `transaction-rewards.js`
  and `quests.js` use: bumps `users/{userId}.points` and writes a `pointsLedger` entry tagged
  `'Payogotchi'`, type `'bonus'`, so it shows up in Point History same as everything else.
- New route: `POST /users/:userId/payogotchi/milestone-bonus`, added to `backend/routes/api.js`
  right after the existing payogotchi GET/PUT routes.

### How the client fires it

`PetService` computes the same bonus scale client-side (kept in sync with the backend's copy —
**if you ever change the scale/amounts, both `pet.service.ts`'s `levelUpBonus()` and
`payogotchi-rewards.js`'s `levelUpBonus()` need updating together**) so the UI can show "+X NETS
Points" immediately without waiting on the network round trip, then fires a fire-and-forget POST
to actually credit it — same "client-authoritative, never blocks on the network" pattern the rest
of Payogotchi already uses for saving pet state. A jump across multiple levels in one XP grant
(rare, but the tutorial's flat +100 XP could theoretically do it early on) collects a bonus for
every level actually crossed, not just the final one.

### Known gap

Real per-transaction points (`pointsAwarded` from a QR payment) already surface in the Home QR
success toast (`buildRewardsToastMessage`, wired up previously) but are **not yet threaded into
Payogotchi's own Transaction Feedback modal** (`06`, "You paid X" popup) — that modal's NETS
Points line only ever shows non-zero on an actual level-up/evolution now. Showing the real
per-transaction points there too would mean threading `pointsAwarded` from the payment response
through `PetBridgeService.record()` into the queued `TransactionResult` — didn't do this yet since
it wasn't asked for, flagging it here in case it's wanted later.

---

## 2026-08-04 (2) — Tutorial completion now actually celebrates, and only pays out once

### 1. Fixed: finishing the tutorial never showed the Level Up modal

**Bug:** completing the Tapatchi tutorial granted +100 XP (enough to level up in some cases) but
never showed the Level Up popup — regardless of which character (egg colour) the user had. Not an
animation/asset problem: `tapatchi-tutorial.page.ts`'s `finish()` called `PetService.addXp()`
directly, which only mutates the pet's numbers. It never builds the `TransactionResult` that
`payogotchi-home.page.ts`'s `celebrate()` needs, and never queues anything on
`PetBridgeService` — the mechanism Home actually reads from on `ionViewWillEnter()`. Real
transactions work because `applyTransaction()` → `PetBridgeService.record()` → Home's pending-
celebration queue is a complete pipeline; the tutorial only did the first, cosmetic-only step
(a toast).

**Fix:** the tutorial now goes through the same pipeline as a real transaction, minus the
"you paid X" step (there's no merchant):
- `PetService.awardTutorialCompletion(amount)` (new) — grants the XP once, detects level-up /
  evolution the same way `applyTransaction()` does, and persists it
- `PetBridgeService.queueResult(result)` (new) — queues a celebration with no `merchant`, reusing
  the existing pending-celebration queue that Home already drains on `ionViewWillEnter()`
- `PendingCelebration.merchant` is now optional; `payogotchi-home.page.ts`'s `celebrate()` treats
  a missing merchant as "not a purchase" and skips straight to the Level Up / Evolution modal
  instead of the transaction-feedback ("you paid X") step

**Files:** `pet.service.ts`, `pet-bridge.service.ts`, `payogotchi-home.page.ts`,
`tapatchi-tutorial.page.ts`.

### 2. Tutorial XP is now one-time only

**What:** the +100 XP completion bonus can only be claimed once per pet. New `PetState.tutorialCompleted`
flag, set by `awardTutorialCompletion()` on first claim; calling it again returns `null` and grants
nothing. The tutorial itself is unrestricted — users can re-read it as many times as they like
(e.g. from "How Payogotchi Works" deep-links), they just won't earn XP again after the first time.

**Files:** `pet.model.ts` (new field), `pet.service.ts` (`freshState()` default `false`;
`seedReturningUser()` demo seed set to `true` since that pet is already established).

**Test it:** finish the tutorial once → toast + (if it crossed a level threshold) the Level Up
modal. Read through it again and hit "Get Started" a second time → toast says "Thanks for
reviewing" and no further XP is granted.

---

## 2026-08-04 — Tapatchi rigging pilot, Home cleanup, real Journey stats

### 1. Tapatchi component — pink character rigged as inline SVG (pilot)

**What:** `pink` now renders as inline SVG with named part-groups (`body`, `arm-left`/`arm-right`,
`ear-left`/`ear-right`, `head-group` for the headband/nose/face-shine, `eyes`, `cheek-left`/
`cheek-right`, `mouth`) instead of a flat `<img>`. It can now animate per-part — ears sway, arms
move independently — the same way the original hand-drawn green Tapatchi already worked.

**Why:** the other 6 Figma-exported characters (blue, orange, yellow, white, black, purple) only
support whole-character motion (bounce/jump/shake) because they're flat exported vectors shown via
`<img>` — there was no way to animate just an ear or arm.

**Files:**
| File | Change |
|------|--------|
| `src/app/components/tapatchi/tapatchi.component.ts` | New `RIGGED_VARIANTS` list (`green`, `pink` so far); `isInlineGreen` generalised into `isRigged`/`isPlainArt`; new `resolvedPose` getter |
| `src/app/components/tapatchi/tapatchi.component.html` | Pink's `happy` and `fainted` poses inlined as grouped `<svg>` (each pose keeps its own Figma viewBox — the two poses are not in a shared coordinate space) |
| `src/app/components/tapatchi/tapatchi.component.scss` | New `ear-sway` keyframe; existing green keyframes (`idle-bounce`, `excited-jump`, `sad-droop`, `starving-shake`, `sleeping-breathe`) extended to also target `.head-group`; green's hardcoded mood-colour overrides rescoped to `[data-variant="green"]` so they stop leaking onto pink's `.body`/`.cheek` elements; added pink-specific fallback-mood tint filters (mirrors the existing `.is-art.is-fallback-pose` rules, targeting `.tapatchi-svg` instead of `.tapatchi-art`) |

**Status:** pink verified pixel-identical to the original Figma export (rasterized both with `sharp`
and compared) before wiring into the template; `ng build` passes. Green's `<defs>`/`<clipPath>`/
`<filter>` were intentionally dropped when inlining pink — they'd `id`-collide across the many
simultaneous instances the `/dev` grid renders; the existing `.tapatchi-svg` CSS drop-shadow covers
it instead.

**Remaining:** blue, orange, yellow, white, black, purple are unchanged — still `<img>`-based,
whole-body motion only. Converting each the same way needs its own visual pass first (rasterize +
inspect) to map that character's Figma path indices to body parts; they're not all shaped the same
(not every character has ears, for instance), so this isn't a mechanical repeat of the pink diff.

**Test it:** `http://localhost:8100/tabs/payogotchi/dev` → pick "pink" → animations on → compare
ear/arm motion against another character in the grid.

---

### 2. Payogotchi Home — demo mode + quests removed, layout reworked

**What:** removed the "🎮 DEMO MODE" block (manual transaction / level-up / evolve / faint /
return / reset-XP-cap buttons) and the "📋 Today's Quests" block from the Home screen. Real
gameplay — actual NETS transactions via `PetBridgeService` — still triggers the same feedback →
level-up → evolution modal chain; that logic was not touched.

**Layout:** Play / Snacks / Dress now sit pinned to the bottom of the page (`margin-top: auto`
inside a full-height flex column) instead of mid-page above the removed sections. The pet section
now grows to fill the freed-up space so the Tapatchi stays vertically centred rather than stuck
near the top.

**Files:**
| File | Change |
|------|--------|
| `payogotchi-home.page.html` | Demo-mode and quests sections removed; actions section moved to the end of `.home-screen` |
| `payogotchi-home.page.scss` | `.home-screen { min-height: 100% }`, `.home-stage { flex: 1; align-items: center }`, `.home-actions { margin-top: auto }`; decorative glow/star positions switched to percentage-based so they still track the pet; removed dead `.home-demo*` / `.home-quests*` rules |
| `payogotchi-home.page.ts` | Removed now-dead members: `DemoTxn`/`Quest` interfaces, `demoTxns`, `quests`, `runTransaction()`, `resetXpCap()`, `restartOnboarding()`, `openLevelUp()`, `openEvolve()`, `openFaint()`, `openReturn()`, `openQuests()`, and the unused `TxnCategory` import |

**Heads up:** those demo buttons are gone from Home entirely. For manual QA of a "returning user"
pet, use the dev test page instead — `http://localhost:8100/tabs/payogotchi/dev` → "⭐ Returning
user (Home)" still calls `PetService.seedReturningUser()`.

**Note:** the stats display (XP / Happiness / Hunger) and pet-centring were iterated on further
after this — check the current `payogotchi-home.page.html`/`.scss` directly for the live structure
rather than assuming this entry is pixel-exact to what's on disk now.

---

### 3. Pet Settings — Journey stats are now real, not hardcoded

**What:** "Days Together", "Total Transactions", "Total XP Earned", "Favourite Merchant", and
"Longest Streak" on the Tapatchi Settings page now read live off actual pet history, instead of a
static demo array that always showed `12 days` / `47` / `12,450` / `Starbucks` / `7 days`
regardless of the real pet's age or activity.

**New `PetState` fields:** `createdAt`, `totalTransactions`, `totalXpEarned`, `merchantCounts`,
`currentStreak`, `longestStreak`, `lastTransactionDate`.

**`PetService` changes:**
| Area | What changed |
|------|--------|
| `completeOnboarding()` | Stamps `createdAt` once — the pet's "birthday", used for Days Together |
| `addXp()` | Also accumulates `totalXpEarned`, which never resets on level-up (unlike `xp`, which resets each level) |
| `applyTransaction()` | Increments `totalTransactions`, tallies `merchantCounts`, and updates the daily streak (`currentStreak` / `longestStreak`) on every qualifying transaction |
| New getters | `daysTogether`, `favouriteMerchant` |
| `migrateLegacyFields()` (new, runs on load + after cloud sync) | Backfills `createdAt` for already-onboarded pets saved before this feature existed (stamps "now" instead of showing 0 days); backfills `totalXpEarned` from the pet's current level/xp via `100 * (level-1) * level / 2 + xp` |
| `seedReturningUser()` | Demo seed updated with matching realistic values (12 days / 47 txns / 12,450 XP / Starbucks / 7-day streak) so the dev "Returning user" button still looks right |

**Files:** `src/app/models/pet.model.ts`, `src/app/services/pet.service.ts`,
`src/app/pages/payogotchi/pet-settings/pet-settings.page.ts`.

**Known limitation:** `totalTransactions`, `merchantCounts`, and the streak fields can't be
backfilled for pets that existed before this change — there's no historical transaction log to
reconstruct them from, so they start counting from zero going forward for pre-existing pets. Only
`createdAt` and `totalXpEarned` get a one-time backfill, since those are derivable from state that
already existed (onboarded flag, level, xp).

**Test it:** create a brand-new pet, make a few transactions on different days/merchants, then
open Tapatchi Settings — the Journey card should track them for real.
