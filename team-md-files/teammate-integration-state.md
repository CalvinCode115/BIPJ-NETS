---
name: teammate-integration-state
description: Current state of every teammate's feature, the concrete integration hooks between them and Payogotchi, and a done/not-done checklist for Calvin's part
metadata:
  type: project
---

# Payogotchi — Integration State & Team Overview

**Snapshot as of 2026-08-16 (v2 pass, after the 13 Aug team updates).**
**Written by:** Calvin. **Audience:** the whole team — read this to see where every feature
actually stands and what's left before the pieces are fully wired together.

> Supersedes the 2026-08-04 version of this file. Where the two disagree, this one is current.
> The teammates' own 13 Aug write-ups live in [[13Aug_Updates]] — that file is the authority on
> *their* changes; this file is the authority on *Payogotchi's* state and the hooks between us.

**Verification note:** every item below marked ✅ **verified 16 Aug** was checked against the
code this session, not carried over on trust. Items marked ⚠️ *unverified* are inherited from
the previous snapshot and still need a look.

---

## ⚠️ Branch status — CORRECTED, read this first

The previous version of this file said *"`origin/main` is still the untouched initial template
(2 commits total)"*. **That is no longer true.** Verified 16 Aug:

| Fact | State |
|---|---|
| `origin/main` tip | `9723884 Merge pull request #1 from CalvinCode115/calvin-payogotchi` |
| Is the v1 Payogotchi work on main? | **Yes** — PR #1 merged `calvin-payogotchi` (`9b0a01f`) into main |
| Current working branch | `calvin-phase2` @ `99b7883` |
| `calvin-phase2` vs `origin/main` | **12 ahead**, 1 behind (that 1 is just the merge commit) |
| `calvin-phase2` vs `origin/calvin-payogotchi` | 12 ahead, 0 behind — payogotchi branch is fully contained |

So v1 *did* ship to main. What is **not** on main is the 12 commits of newer work on
`calvin-phase2` — Eron's travel/FX integration, Yunen's rewards rebalance, Jun Jie's Home split,
and Calvin's phase-2 work.

> **Push gotcha:** `calvin-phase2` currently tracks **`origin/Eron`**, not
> `origin/calvin-phase2`. A bare `git push` from it pushes onto Eron's branch. Fix with
> `git push -u origin calvin-phase2`. See [[COMMANDS]] §2.2.

---

## Tab structure

**5 visible tabs:** Home, Pay, Travel, Rewards, Payogotchi.
`fx-tracker` is a 6th *route* nested under Travel (`/tabs/fx-tracker`) with no tab-bar button of
its own. There is also a Python FastAPI service under `src/app/security-stuffs-hehe/`
(`uvicorn main:app --port 8000`) backing Eron's FX rates. See [[PROJECT-STRUCTURE]].

---

## Per-teammate state

### Jun Jie — Home / Pay (payments, cards, DNA engine)

**State: mature, bridged, and now restructured.**

- QR pay `POST /api/users/:userId/payments/qr`, P2P `POST /api/users/:userId/transfers` — both
  write real Firestore transactions and call `PetBridgeService.record()`. **Still working.**
- **New 13 Aug:** Home was split into parent page + `components/` + `services/`. His Part 3 is an
  explicit **do-not-touch list** — don't delete those folders, don't collapse Home back into one
  page, don't remove `resolveTxnRewardsDisplay()`, don't show `+0 pts` (use the grey
  "Daily limit" label), don't backfill old transaction docs.
- **New 13 Aug:** transactions now persist real `points_awarded` / `xp_gained`; new route
  `PATCH /users/:userId/transactions/:txnId/rewards` writes XP back after the pet bridge runs.
  **Do not remove it** — XP stops persisting on txn rows if you do.
- **Boundary respected:** he explicitly does not edit `payogotchi/**` or `pet.service.ts`, and
  reaches us only through `PetBridgeService.record()`.

**Outstanding for Payogotchi: nothing from his side.** Constants to keep in sync if earning
rules ever change: `$1 = 10 XP` (display, `txn-rewards-display.ts`) and the pet stage daily XP
caps 200/400/600.

### Yunen — Rewards (quests, challenges, points, marketplace, vouchers)

**State: fully built, rebalanced 9–11 Aug, still bridged in only one direction.**

**Her 13 Aug economy changes that affect us:**
- Merchant spend went from **10 pts/$1 → 1 pt/$1**.
- New caps: **300 pts/day**, **20 point-earning txns/day**, **5,000 max balance**.
- She names Payogotchi milestones as the exact example of a feature that must route through
  `getTodaysPointsBudget()` (`backend/services/points-budget.js`) and `capBalanceAward()`
  (`backend/services/points-balance-cap.js`).

**What's bridged — Payogotchi → Rewards:** level-up/evolution credits real points via
`backend/services/payogotchi-rewards.js` + `POST /users/:userId/payogotchi/milestone-bonus`.
Payogotchi Home reads the real balance via `PointsService.getBalance()`.
**As of 16 Aug this now respects both her caps and runs transactionally — see P0-1 below.**

**What's NOW bridged — Rewards → Payogotchi (built 16 Aug):** claiming a quest or challenge
queues its `+N XP` / `+N Pet Happiness` reward server-side; Payogotchi Home drains and applies it
on next open, with the normal level-up/evolution celebration. See P0-3 below for the design and
for the one-line hook added to her three claim handlers. **The cosmetic half is still owed** —
`'rare'`/`'legendary'` rewards are ignored until Payogotchi has a cosmetics system (P1-6).

**Also from her doc, still open:** whether Payogotchi-specific actions (tutorial completion,
feeding) should fire `POST /api/users/:userId/quests/events`. Real payments are already covered
via Jun Jie's pipeline. Probably nothing owed — needs a 2-minute sync with her to close.

### Eron — Travel (AI Concierge, FX Tracker)

**State: mature, and NOW bridged to Payogotchi — this is new since the last snapshot.**

As of `99b7883`, a travel payment in a foreign currency dispatches a
`nets:travelPaymentCompleted` window event; `home.page.ts` listens and calls
`petBridge.record(detail.sgdEquivalent, detail.category, detail.venue)`. **Confirmed working
end-to-end by Calvin on 15 Aug** — overseas trip payments now grant pet XP and animate.

Key detail: it passes the **SGD equivalent**, not the raw foreign amount, so XP and points are
not inflated by the exchange rate.

Other Eron changes worth knowing: card money now lives in a `multi_currency` map and
**`card.balance` is deprecated** (use `getCardFundsAmount()`); the backend `/deduct` fee bug is
fixed. ✅ **verified 16 Aug** — no file under `payogotchi/`, `pet.service.ts`, or
`pet-bridge.service.ts` reads `card.balance`, so the deprecation breaks nothing on our side.

---

## What's LEFT for Calvin — prioritised checklist

### 🔴 P0 — correctness / blocking

- [x] **1. Milestone points bypass Yunen's caps.** ✅ **FIXED 16 Aug.**
      *Was:* `payogotchi-rewards.js` `creditPoints()` did a raw
      read-then-`userRef.update({ points: current + amount })`, calling neither
      `getTodaysPointsBudget()` nor `capBalanceAward()` and not wrapped in a transaction — so
      pet milestones could push a user past 300/day and past the 5,000 ceiling, and could race
      a concurrent credit.
      *Now:* `awardPetMilestone()` runs inside `db.runTransaction()`, does all reads first
      (user doc, then today's budget), applies the daily cap then the balance ceiling using the
      same two helpers and the same order `quests.js` uses, and spends the allowed budget across
      milestones in order so an early level still gets its ledger entry on a partially-affordable
      multi-level jump. Ledger entries stay `type: 'bonus'` — counts toward the 300/day points
      cap, correctly **not** toward the 20-transactions/day cap, since a milestone isn't a spend.
      Return shape gained `requested` and `capped` alongside `pointsAwarded` (additive; the
      client fire-and-forgets the response, so nothing broke).
      **Verified** with a stubbed-Firestore harness — 13 checks covering the uncapped path,
      daily-cap clamping, cap exhaustion, the 5,000 ceiling, multi-level partial fill, the
      no-milestone no-op, and ledger typing. All passed.
      ✅ **Follow-on RESOLVED 16 Aug** — `PetService.awardMilestoneBonus()` no longer leaves an
      unreconciled optimistic figure on screen. The backend's actual award is carried back and
      applied, and a milestone clipped by the daily cap now says so. See P1-5 below.

- [x] **2. The care loop can never fire — no decay, pet can never faint.** ✅ **FIXED 16 Aug.**
      *Was:* (diagnosis kept below for the record.)
      *Now:* `PetService` gained a real decay engine —
      - `applyDecay()` — retroactive, not on a timer: on load it consumes however many **whole**
        days have passed since `lastDecayAt` and applies that much decay at once. Leftover hours
        stay on the clock, so opening the app twice in a day doesn't double-decay, and opening it
        every 23 hours doesn't decay never. Rates: hunger −10/−15/−20 per day by stage,
        happiness −5/day, both clamped at 0. No-ops for a pet that hasn't hatched.
      - **Backdated faint** — if hunger bottomed out *inside* the elapsed window, the starvation
        clock is stamped to the day it actually hit zero, not to now. This is what lets a user
        who was away a week come back to an already-fainted pet instead of one just starting its
        countdown. New `PetState.hungerZeroSince` field carries this across restarts.
      - `refreshFaint()` sets `faintedAt` once hunger has been 0 for 3 straight days; `revive()`
        (feeding, or any food transaction) clears it and wakes the pet at ≥50 hunger.
      - `mood` now returns `'fainted'`, outranking every other mood, and `statusText` has a line
        for it. New `isFainted` / `daysStarving` getters for the UI.
      - `simulateDaysPassing(n)` demo helper rewinds the decay clock (and `lastFedAt` /
        `hungerZeroSince` with it) then settles the decay — the whole loop in seconds instead of
        three real days.
      - Called from the constructor, from `syncFromCloud()` after adopting the cloud pet, and at
        the top of `applyTransaction()`. `completeOnboarding()` stamps `lastDecayAt` at hatch.
      **Verified** by bundling the real `PetService` with esbuild and driving it — 23 checks
      covering per-stage rates, whole-day accounting, partial-day carry-over, clamping,
      backdated fainting, the revive paths, mood precedence, the demo button, the un-hatched
      guard, and idempotency. All passed. Typecheck clean.
      **Knock-on:** `home.page.ts:131` already routes to `welcome-back` when `result.revived` is
      true, so **14 Welcome Back is now reachable** for the first time. **13 Fainted Pet is still
      orphaned** — nothing navigates to it; wiring it is one `*ngIf="pet.isFainted"` on Home,
      tracked as part of P2-9.
      *Original diagnosis, for the record:* ✅ *verified 16 Aug.*
      `lastDecayAt` is **written** on init/reset (`pet.service.ts:107,146`) but **never read**;
      there is no elapsed-day decay anywhere. `faintedAt` is only ever **cleared** to `null`
      (`:106,145,258,315`), never **set**. Hunger only ever *increases* (`:254,313`).
      Consequences, in order of severity:
      - hunger and happiness never decay, so the care loop is decorative
      - the pet can never faint → **13 Fainted Pet is unreachable**
      - `TransactionResult.revived` can never be `true` → **14 Welcome Back is unreachable**,
        despite being fully built from Figma
      *This is the single biggest gap. It was flagged in [[CLAUDE]] §7 back in July and is still
      open. Fix: retroactive decay on load from `lastDecayAt`, set `faintedAt` when hunger hits
      0 for ≥3 days, plus the "Simulate 1 day passing" demo button.*

- [x] **3. `awardPetProgress` for Yunen.** ✅ **BUILT 16 Aug.**
      Quest/challenge XP and pet-happiness rewards now actually reach the pet.

      **Design — why a queue, not a direct write.** The pet is client-authoritative: `PetService`
      owns XP, levelling, evolution and the celebration chain, and it overwrites the pet doc on
      its next save. If the backend added XP straight to Firestore, `PetService` would clobber
      it, no level-up would be detected, and nothing would celebrate. So a claim only ever
      *records* what the pet is owed; the client drains that queue and applies it through the
      normal `addXp()` path, getting level-up/evolution detection for free.

      **New — `backend/services/payogotchi-progress.js`** (Payogotchi-owned):
      - `extractPetReward()` parses her reward labels, since the amount lives in the human-
        readable text (`'+100 XP'`, `'+5 Pet Happiness'`) not a numeric field. Deliberately
        strict — an unrecognised label is ignored rather than guessed at.
      - `queuePetReward(tx, db, userId, rewards, sourceType, sourceLabel)` — pure writes, same
        contract as her `grantBadges()`, safe inside her existing claim transaction.
      - `listPendingPetRewards()` / `ackPetRewards()` — drain + ack.
      - New Firestore subcollection `users/{id}/petRewardQueue` (`userPetRewardQueueRef`).

      **New routes:** `GET /users/:userId/payogotchi/pending-rewards` and
      `POST /users/:userId/payogotchi/pending-rewards/ack`.

      **`PetService` gained** `awardPetProgress({ xp?, happiness? })` — applies an external
      grant and returns a full `TransactionResult` so it celebrates like a real transaction —
      and `drainPendingRewards()`, which fetches, applies, then acks. **Acks after applying**,
      so a crash mid-drain leaves the grant queued for next time rather than losing XP the user
      was already told they earned.

      **Deliberate call:** quest XP is **not** subject to the daily XP cap. That cap exists to
      stop *spending* being farmed for XP; a quest claim is already one-time per period, and
      capping it would silently shrink a reward promised on the card the user just tapped.

      **Wired into Payogotchi Home** — `ionViewWillEnter()` drains the queue, folds the grants
      into one result for display, and runs the normal celebration chain (or a toast if a
      payment celebration is already on screen, so nothing is silently swallowed).

      **Touched in Yunen's `quests.js`:** one import plus **one line in each of her three claim
      handlers**, directly beside the existing `grantBadges()` call. Nothing else in her file
      changed. *Worth telling her, since it's her file.*

      **Verified:** 18 backend checks (every XP/happiness label in her real `seed-quests-data.js`,
      mixed reward arrays, strict rejection of unparseable labels, cosmetics/buffs correctly
      ignored, queue-write behaviour) + 14 client checks (XP grant, level-up detection, evolution
      across the Baby→Teen boundary, happiness clamping, daily-cap bypass, empty-grant no-op,
      full drain-and-ack, empty queue, offline safety). All passed. Typecheck clean, backend
      import chain loads.

      ⚠️ **Not covered — the cosmetic half of her ask.** `'rare'` / `'legendary'` cosmetic
      rewards and `'buff'` rewards are parsed and *deliberately dropped*, because Payogotchi has
      no cosmetics or buff system (P1-6). They are left out entirely rather than queued-and-
      discarded, so nothing vanishes silently. Wire them up when cosmetics exist.

### 🟠 P1 — economy & integration correctness

- [x] **4. Rescale the milestone bonuses for the new economy.** ✅ **DONE 16 Aug.**
      The old scale (5/10/15/20/30/40/50/100, evolve 100) was picked when spending paid
      **10 pts/$1**. After Yunen's rebalance to **1 pt/$1** it silently became ~10× more
      significant than designed — **10.4%** of a user's lifetime points instead of ~1%.

      **New scale (halved, floor 3):**

      | Levels | 2–10 | 11–20 | 21–25 | 26–30 | 31–35 | 36–40 | 41–49 | 50+ | **Evolution** |
      |---|---|---|---|---|---|---|---|---|---|
      | Points | 3 | 5 | 6 | 8 | 12 | 15 | 20 | 40 | **50** |

      Modelled against the real XP curve (`xpMax = level × 100`, $1 = 10 XP, 122,500 XP to
      level 50 ≈ $12,250 ≈ 12,250 spending points):

      | | by lvl 16 | by lvl 36 | lifetime | share |
      |---|---|---|---|---|
      | Old | 205 | 710 | 1,420 | 10.4% |
      | **New** | **107** | **322** | **602** | **4.7%** |

      **Why not a straight ÷10** (which would have restored ~1.1% exactly): it pays 1 point for
      every level from 2 to 20, and nineteen consecutive "+1 NETS Point" celebrations read as
      broken rather than rare. The floor of 3 keeps every level-up legible.
      **Why evolution is 50, not higher:** at 50 it's 17% of the shared 300/day points cap, so a
      big moment rarely arrives silently clipped by P0-1's capping. A 150-point evolution would
      be 50% of a day's budget — the most memorable reward would be the most likely to be cut.

      Changed in **both** copies (`payogotchi-rewards.js` + `pet.service.ts`); verified byte-
      identical, live code reproduces the modelled numbers exactly, and the P0-1 cap tests still
      pass (their expectations now derive from the live scale rather than hardcoded numbers).
      ⚠️ **Tell Yunen** — milestone points draw from her shared 300/day budget, so this changes
      how much of it Payogotchi consumes.

- [x] **5. `levelUpBonus()` duplication / optimistic display.** ✅ **RESOLVED 16 Aug** — by
      reconciliation rather than de-duplication.

      **The diagnosis changed on inspection.** The duplication was the symptom; the actual
      defect was that the client treated *its own guess* as authoritative for display. It
      computed a bonus, showed it (`levelReward` in the level-up modal, `result.pointsEarned`
      in the feedback modal), POSTed, and **discarded the reply**. Two independent drift
      sources followed:
      - *scale drift* — edit one copy, the other silently disagrees (hypothetical), and
      - *the daily cap* — **already live**. Since P0-1 the backend clamps to the remaining
        300/day budget, which the client cannot know by design. A user near their cap saw
        "+20 NETS Points!" and received 3, silently.

      Syncing the two copies would have fixed only the first. So instead:

      **`PetService`** now keeps the reply. `milestoneBonusConfirmed` (a `Subject`) fires for
      an already-open screen so an in-flight modal corrects its number in place;
      `consumeMilestoneConfirmation()` covers the queued case — a Pay-tab payment whose
      celebration doesn't play until Payogotchi is opened, by which time the reply came and
      went. A new milestone clears any unconsumed confirmation, so an old figure can never be
      applied to a later one. Offline, the optimistic figure is left alone (guessing "0" would
      be worse than guessing high).

      **Payogotchi Home** subscribes on construction, unsubscribes in `ngOnDestroy`, and on
      confirmation rewrites **both** display sites, refreshes Total Activity, and — when
      `capped` — shows *"Daily points limit — 3 of 20 NETS Points added"*, matching how Jun
      Jie's transaction rows already report the same cap.

      **The duplication is now harmless rather than dangerous**: the two copies may drift and
      the user still only ever sees what was actually credited. A sync-check script is still
      worth adding one day, but it is no longer protecting against anything user-visible.

      **Verified** — 13 checks: optimistic display, confirmation on agreement, the capped case,
      a deliberately *drifted* backend scale (client says 5, backend says 999 → backend wins),
      the queued path, clear-on-consume, stale-confirmation isolation, offline, and no-POST-
      without-a-milestone. All passed. Typecheck clean.

- [ ] **6. Cosmetics system — entirely unbuilt.** ✅ *verified 16 Aug.*
      `cosmetics-dressup.page.ts` is **9 lines** of scaffold; `pet.service.ts` contains **zero**
      references to cosmetics/inventory/equip. Blocks the cosmetic half of Yunen's ask (#3) and
      is the last major unbuilt piece of Payogotchi itself.

- [x] **7. Real per-transaction points inside Payogotchi's own Transaction Feedback modal.**
      ✅ **FIXED 16 Aug** (and the diagnosis was sharper than the old note suggested).

      **Was:** the feedback popup rendered `result.pointsEarned`, which is *milestone-only* by
      design. So a $20 lunch showed "+200 XP, +40 Hunger" and **no points at all**, even though
      it really earned 20. Worse, on a level-up the popup *did* show a points line — the
      milestone (e.g. "+3 NETS Points") — sitting in a "what this payment earned" list, reading
      as though the payment earned 3 rather than 23. And the same +3 also appeared on the
      level-up screen, so one number showed twice while the larger one showed never.

      **Now:** `TransactionResult` gained an optional `spendPointsEarned`, kept deliberately
      **separate** from `pointsEarned` — merging them would have let P1-5's milestone
      reconciliation overwrite the spend figure. `PetBridgeService.record()` takes an optional
      4th arg and `qr-payments.service.ts` passes `res.pointsAwarded`, which it already had in
      its response and was only using for the toast. It's the **post-cap** number, so no
      estimating. The popup now shows two labelled rows:
      `🎁 +20 NETS Points` and `⭐ +3 Level-up bonus`.

      **Verified** — 7 checks: spend points carried through, milestone stays separate, XP
      unaffected, P2P passing nothing leaves the field absent, zero never renders a "+0" row,
      and both awards coexist on a level-up transaction. Typecheck + SCSS compile clean.

      ⚠️ **Travel payments still show no spend points** — `travel.page.ts:1860` calls
      `record()` without them because its payment result doesn't expose `pointsAwarded` at that
      point. XP and hunger work; only the points row is missing on that path.

- [x] **7b. Celebration modals clipped long content.** ✅ **FIXED 16 Aug** — found while adding
      the row above. `.payo-modal-body` is a scrolling flex column with `justify-content:
      center`; plain `center` pushes overflow off **both** ends, and anything above the scroll
      origin can never be scrolled back to, so the top was silently unreachable. The modal was
      already `--height: 100%` — height was never the problem. Changed to
      `justify-content: safe center`, which centres while content fits and falls back to
      flex-start once it overflows. Affects all three celebration modals.

- [ ] **8. Verify the travel-payment path doesn't double-count.** The bridge dedupes by
      transaction id, but travel payments arrive as a **window event** rather than through the
      txn stream. Needs a check that a travel payment followed by a Home refresh can't record
      the same spend twice. ⚠️ *unverified — new since 13 Aug.*

### 🟡 P2 — housekeeping & polish

- [ ] **9. Redundant routes still registered.** ✅ *verified 16 Aug.*
      `payogotchi-routing.module.ts` still registers `transaction-feedback` (:59), `level-up`
      (:66), `stage-evolution` (:73), `fainted-pet` (:108), `welcome-back` (:115) as full pages,
      even though Home renders all of them as inline modals. [[CLAUDE]] §5 calls these
      Category B/C — they should be modals/conditional renders, not routes. Deleting them is
      also the clean answer to the lecturer's unguarded-routes question.

- [ ] **10. Rig the remaining 6 characters.** ✅ *verified 16 Aug* — `tapatchi.component.html`
      has 6 inline `<svg>` blocks plus a single `<img>` fallback (:418). Green and pink are
      rigged; blue, orange, yellow, white, black, purple still render as flat art with
      whole-body motion only. Per [[project-tapatchi-svg-rigging]], do these **one at a time
      with a visual check each** — anatomy differs, it isn't a mechanical repeat.

- [ ] **11. Sad/starving moods have no drawn pose** on any Figma character (tint + motion only).
      Honest limit of the source art. Lower value once #2 is fixed, but more visible then too.

- [x] **12. Secrets are correctly git-ignored.** ✅ *verified 16 Aug — closing this item.*
      `.gitignore:82 *.env` matches `src/app/security-stuffs-hehe/.env`, `:84 .venv/`, and
      `:44-45` cover the Firebase service-account JSONs. `git ls-files` shows **no** `.env` or
      service-account file tracked. Previously flagged in [[TECH-REVIEW-PREP]] as needing a
      check — it's clean.

---

## What Calvin has DONE (unchanged, still true)

### Core game loop
- [x] `PetService` — single source of truth: XP, hunger, happiness, level, stage, daily XP cap
      (200/400/600 by stage), per-txn XP cap (250), happiness multiplier (0.5×–1.2×)
- [x] `applyTransaction()` returns a `TransactionResult`; Home orchestrates the
      feedback → level-up → evolution modal chain off it
- [x] Persistence: localStorage (per-user-namespaced) + debounced Firestore write through the
      Node backend (`GET`/`PUT /api/users/:userId/payogotchi`) — [[payogotchi-firestore-ready]]
- [x] Onboarding guard (`payogotchi-entry.guard.ts`); `syncFromCloud()` reconciles before routing

### Bridges
- [x] **Real payments → pet** (QR + P2P → `PetBridgeService` → `PetService`), 3 Aug
- [x] **Travel payments → pet** (Eron's `nets:travelPaymentCompleted` → `petBridge.record()`
      on SGD equivalent), confirmed working 15 Aug
- [x] **Pet milestones → real NETS Points** (level-up/evolve → Yunen's balance/ledger), 4 Aug
      — *works, but see P0-1 for the cap gap*
- [x] Combined "XP + real points" toast on the Home QR success flow

### Content & UX
- [x] Green Tapatchi rigged (hand-drawn inline SVG, per-part animation)
- [x] Pink Tapatchi rigged as the conversion pilot, 4 Aug
- [x] Payogotchi Home restyled into the Hero / Care / Total-Activity layout
- [x] Pet Settings "Journey" card backed by real stats (`createdAt`, `totalTransactions`,
      `totalXpEarned`, `merchantCounts`, `currentStreak`, `longestStreak`)
- [x] Tutorial completion fires the Level Up modal; +100 XP is one-time (`tutorialCompleted`)
- [x] 14 Welcome Back screen built from Figma — **reachable as of 16 Aug**, now that the pet can
      actually faint and be revived (P0-2)
- [x] Time-based decay + faint/revive care loop, 16 Aug (P0-2)
- [x] **XP History page**, 16 Aug — new `xp-history` route, reached from Pet Settings →
      Pet Management (below Choose New Egg). Day-by-day record of where the pet's XP came from,
      **across every month**, newest first, with a day stepper.
      **Derived from Jun Jie's stored `xp_gained`** rather than a second pet-side log: his
      13 Aug change persists XP per transaction and the shared formatter already returns it, so
      this works retroactively with no new storage and no backend changes. Eron's travel
      payments are included too — `travel.page.ts:1866` calls `recordTxnRewards()` exactly like
      QR payments do, so travel XP lands on the transaction like any other.

      **Cross-month fan-out:** the transactions API filters per month
      (`firestore-store.js:311` only skips filtering when month/year are both falsy, and the
      route always supplies them), so the page requests the last 12 months in parallel via
      `forkJoin` and merges. A month that fails contributes an empty batch instead of failing
      the page. The API's `date` is a display string with no year (`'16 Aug'`), so each batch is
      tagged with the period it was fetched under to build a real `yyyymmdd` sort key —
      otherwise days can't be ordered across month boundaries.

      **Reconciliation, added after a real confusion:** the page shows *"from payments"* beside
      the pet's *"XP all time"* and, when they differ, states the gap explicitly — e.g.
      *"300 XP isn't listed below — tutorial bonus, quests, or payments made before XP was
      recorded on transactions."* Without this, a legitimate gap reads as lost data. Worked
      example: a level-4 pet with 100 XP banked has necessarily earned 700 XP (100+200+300+100),
      of which the 100 tutorial bonus (`COMPLETION_XP`, `tapatchi-tutorial.page.ts:19`) can
      never be itemised, because it has no transaction.

      **Verified** — real `ng build` (AOT template compile, own lazy chunk) plus 17 logic checks:
      multi-month collection, newest-first ordering across month boundaries, year-bearing labels,
      same-day aggregation, exclusion of zero/null XP rows, capped-flag passthrough,
      reconciliation arithmetic including the never-negative floor, and day stepping across
      months. All passed.

      *Structural limit that remains:* a transaction-derived list can never itemise XP that
      isn't a payment. A pet-side XP log would, but starts empty.

---

## Recommended order of attack

1. ~~**P0-2 (decay + faint)**~~ — **done 16 Aug.**
2. ~~**P0-1 (points caps)**~~ — **done 16 Aug.**
3. ~~**P0-3 (`awardPetProgress`)**~~ — **XP + happiness half done 16 Aug.** Cosmetic half
   deferred to P1-6 as planned.

**All three P0 items are now closed.** Remaining, in order:

4. ~~**P1-4 / P1-5**~~ — **both done 16 Aug.**
5. **P1-6 (cosmetics)** — the last big build, and the blocker on the rest of Yunen's ask.
6. **P1-7 / P1-8** — real per-txn points in the feedback modal; verify the travel-payment path
   can't double-count.
7. **P2** — route cleanup (incl. wiring the fainted Home layout), art polish. None blocking.

---

## Open questions for the team

- **Yunen:** should the pet's *own* actions (tutorial completion, feeding, mini-game) fire
  quest events, or only real NETS transactions? Assumption is only-real-transactions.
- ~~**Yunen:** after P0-1 caps the milestone bonus, is a silently-reduced pet bonus acceptable,
  or should Payogotchi surface a "daily limit reached" state like Jun Jie's txn rows do?~~
  **Answered by building it (P1-5):** Payogotchi now shows *"Daily points limit — X of Y NETS
  Points added"*, matching Jun Jie's convention. Flag to Yunen for consistency, not approval.
- **Eron:** is `nets:travelPaymentCompleted` guaranteed to fire exactly once per payment, or can
  a Home refresh replay it? (Relates to P1-8.)
