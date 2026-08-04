---
name: teammate-integration-state
description: Current state of every teammate's feature, the concrete integration hooks between them and Payogotchi, and a done/not-done checklist for Calvin's part
metadata:
  type: project
---

# Payogotchi — Integration State & Team Overview

**Snapshot as of 2026-08-04 (v1 integration pass).**
**Written by:** Calvin. **Audience:** the whole team — read this to see where every feature
actually stands and what's left before the pieces are fully wired together.

> Superseded doc: this replaces the 2026-08-02 version of this file, which was written before
> the payment bridge, the Rewards tab, and the NETS Points bridge below existed. If anything here
> conflicts with an older note (e.g. [[payogotchi-demo-flow]], written for the 23 Jul demo), this
> file is current.

---

## ⚠️ Branch / push status — read this first

Everything described below is **integrated and working together on the `calvin-payogotchi`
branch, locally** — Calvin's, Yunen's, and Eron's work have all been merged into it
(`9160e7b Merge origin/yunen`, `1cb7552 Merge origin/Eron`), so this branch is a real "v1
integrated" snapshot of the app.

**It has not been pushed or merged to `main` yet.** As of this snapshot:
- `origin/main` is still the untouched initial template (2 commits total).
- `origin/calvin-payogotchi` is **33 commits behind** the local `calvin-payogotchi` branch.
- There are also **38 uncommitted files** in the local working tree on top of that (today's
  session — see [[updates]]).

If the plan is for this to actually be "v1 on main," the remaining steps are: commit today's
working-tree changes → push `calvin-payogotchi` → open/merge a PR into `main`. None of that has
happened yet — flagging it here so the team doesn't assume `main` is up to date before that's
done.

---

## Tab structure (verified against `tabs-routing.module.ts` / `tabs.page.html`)

**5 visible tabs:** Home, Pay, Travel, Rewards, Payogotchi.
`fx-tracker` is a 6th *route* nested under Travel (`/tabs/fx-tracker`) but has no tab-bar button
of its own — it's Eron's FX feature reached from inside the Travel page, not a separate tab. See
[[PROJECT-STRUCTURE]] for the full folder layout.

---

## Per-teammate state

### Jun Jie — Home / Pay (payments, cards, DNA engine)

**State: mature, and now bridged to Payogotchi.**

- QR pay: `POST /api/users/:userId/payments/qr` (`qr-payments.service.ts`)
- P2P transfer: `POST /api/users/:userId/transfers` (`transfers.service.ts`)
- Both write real Firestore transactions via `backend/routes/api.js`, and both already award
  real NETS Points server-side (`backend/services/transaction-rewards.js`, 10 points per $1 —
  QR merchant payments only; transfers don't earn points, by design).
- **Bridged (built 3 Aug, [[payogotchi-payment-bridge]]):** `PetBridgeService.record()` is
  called from both payment paths, feeding the pet real XP/hunger/happiness instead of demo
  buttons. Celebration (feedback/level-up/evolution) is queued and plays the next time the user
  opens the Payogotchi tab.
- DNA/Insights engine ([[guide]], [[CORE-API-FOR-TEAMMATES]]) is unrelated to Payogotchi —
  no integration needed there.

**Nothing outstanding here for Payogotchi.**

### Yunen — Rewards (quests, challenges, points, marketplace, vouchers)

**State: fully built** (all 7 screens — see her own [[rewards-system-overview]]), and **now
partially bridged to Payogotchi** — but only in one direction so far.

**What's bridged (built today, 4 Aug — see [[updates]]):**
Payogotchi → Rewards. A Tapatchi level-up or evolution now credits **real** NETS Points into
the same balance/ledger her `points.service.ts` / `points.js` read from
(`backend/services/payogotchi-rewards.js`, new `POST /users/:userId/payogotchi/milestone-bonus`
route). Payogotchi's own Home screen also now reads the real balance via
`PointsService.getBalance()` for its "Total Activity" display, instead of a fake local counter
it used to keep.

**What's NOT bridged yet — Rewards → Payogotchi (her explicit ask, not started):**
Her own doc flags this directly: several daily/weekly quests and partner challenges promise
rewards like `+100 XP` or a cosmetic unlock, but claiming one of those quests today only credits
the **points** part — the XP/cosmetic portion is stored in the quest template and does nothing.
She's asking for a function on Calvin's side, callable at the moment a quest/challenge is
claimed:
```
awardPetProgress(userId, { xp?: number, cosmeticId?: string })
```
**This is the highest-priority open integration item.** Needs:
1. A `PetService`/backend equivalent that accepts an external XP grant the same way
   `awardTutorialCompletion()` does (see [[updates]] — same shape: apply XP, detect
   level-up/evolve, celebrate).
2. Agreement on what cosmetic IDs actually mean, since Payogotchi doesn't have a cosmetics
   system built yet (`cosmetics-dressup`/`cosmetic-purchase-modal` are still scaffold screens).
3. A decision on *where* this call happens — likely a backend hook in `quests.js`'s claim
   handlers, calling into something Payogotchi-owned (mirroring how `payogotchi-rewards.js`
   already writes into Yunen's points ledger from Calvin's side).

Also from her doc: **quest/challenge progress hook** — `POST /api/users/:userId/quests/events`
should fire after any successful transaction so quest progress advances. Payogotchi's own
transactions already go through the shared transaction pipeline (Jun Jie's), so this should
already be covered for real payments; **not verified this session** whether Payogotchi-specific
actions (e.g. finishing the tutorial, feeding the pet) are expected to fire quest events too —
probably not, since those aren't NETS transactions, but worth a quick sync with Yunen to confirm
nothing's expected there.

### Eron — Travel (AI Concierge, FX Tracker)

**State: mature. Not touched or re-verified this session.** Per the last full read
([[PROJECT-STRUCTURE]], [[FX-CHANGES-FOR-TEAMMATE]]): consumes the DNA engine
(`GET /users/:userId/dna-profile`) for destination/travel-hint personalization, plus its own FX
Tracker sub-feature (Frankfurter rates via a Python FastAPI service on :8000). No Payogotchi
overlap — lowest integration priority, same as previous snapshots.

---

## What Calvin (Payogotchi) has done — full checklist

### Core game loop — done
- [x] `PetService` — single source of truth for XP, hunger, happiness, level, stage, daily XP
      cap (200/400/600 by stage), per-transaction XP cap (250), happiness multiplier (0.5x–1.2x)
- [x] `applyTransaction()` returns a `TransactionResult`; Home orchestrates the
      feedback → level-up → evolution modal chain off it
- [x] Persistence: localStorage (instant, per-user-namespaced) + debounced Firestore write
      through the Node backend (`GET`/`PUT /api/users/:userId/payogotchi`) — see
      [[payogotchi-firestore-ready]]
- [x] Onboarding guard (`payogotchi-entry.guard.ts`) — new user → intro → egg → hatch → name;
      returning user → straight to Home; `syncFromCloud()` reconciles before routing

### Bridges — done
- [x] **Real payments → pet** (Jun Jie's QR/transfers → `PetBridgeService` → `PetService`),
      3 Aug — [[payogotchi-payment-bridge]]
- [x] **Pet milestones → real NETS Points** (level-up/evolve → Yunen's points balance/ledger),
      4 Aug — [[updates]]
- [x] Combined "XP + real points" toast on the Home QR success flow (`rewards-toast.ts`)

### Bridges — not done
- [ ] **Rewards quest/challenge rewards → pet** (`awardPetProgress`, Yunen's ask above) —
      not started
- [ ] Real per-transaction NETS Points (not just the milestone bonus) surfaced inside
      Payogotchi's own Transaction Feedback modal — currently only the Home QR toast shows it
      (flagged as a known gap in [[updates]])

### Content/asset work — partially done
- [x] Green Tapatchi (original hand-drawn inline SVG, full per-part animation)
- [x] 7 additional Figma characters exist as flat exported art (whole-body motion only)
- [x] **Pink rigged as inline SVG** (pilot, 4 Aug) — per-part animation (ears sway, arms move)
      matching green's treatment. See [[updates]] for the how-to.
- [ ] Blue, orange, yellow, white, black, purple — still flat `<img>` art, whole-body motion
      only. Each needs its own visual pass (rasterize + inspect) before rigging the same way;
      not a mechanical repeat since anatomy differs per character.
- [ ] Sad/starving moods still don't have a real drawn pose on any Figma character (tint +
      motion only, honest limit of the source art per character — unchanged this session)
- [ ] Cosmetics system (`cosmetics-dressup`, `cosmetic-purchase-modal`) — screens exist as
      scaffolds, no real inventory/equip logic; blocks Yunen's cosmetic-reward ask above too

### Screens/UX polish — done this session (4 Aug)
- [x] Payogotchi Home — removed the demo-mode block and the static quests block; Play/Snacks/
      Dress pinned to the bottom of the page; pet re-centred in the freed-up space (further
      restyled by Calvin afterward into the current Hero/Care/Total-Activity layout)
- [x] Pet Settings "Journey" card — Days Together, Total Transactions, Total XP Earned,
      Favourite Merchant, Longest Streak are now real (`PetState` gained `createdAt`,
      `totalTransactions`, `totalXpEarned`, `merchantCounts`, `currentStreak`, `longestStreak`),
      not the old static demo numbers
- [x] Tutorial completion bug fixed — finishing the tutorial now actually triggers the Level Up
      modal when it crosses a level (it silently didn't before); the +100 XP reward is now
      one-time only (`PetState.tutorialCompleted`), tutorial itself can still be re-read anytime

### Known housekeeping / cleanup candidates (carried over, unverified this session)
- [ ] Old standalone route-pages `level-up`, `stage-evolution`, `transaction-feedback` are
      redundant now that Home has inline modals for all three — candidates for deletion, kept
      so far "to avoid churn before the demo" per [[payogotchi-phase1-persistence]]
- [ ] `.env` / `.venv` / `service-account.json` git-ignore status — was flagged as
      needing a check in [[TECH-REVIEW-PREP]]; re-verify before pushing to `main`

---

## What happened when (yesterday vs today)

### Yesterday — 2026-08-03 (committed, on `calvin-payogotchi`)
- `09ad5fa` — **Payogotchi payment bridge** (real QR/transfer payments now feed the pet, see
  [[payogotchi-payment-bridge]]), the new-user **intro** screen, and a repo tidy-up
- `9160e7b` — merged `origin/yunen` in — this is where Yunen's fully-built Rewards tab (all 7
  screens, [[rewards-system-overview]]) landed in this branch
- `3a3ed4e` — consolidated every feature's pages under `src/app/pages/<feature>/` (the folder
  layout [[PROJECT-STRUCTURE]] documents)

### Today — 2026-08-04 (uncommitted — see [[updates]] for full detail)
1. Pink Tapatchi rigged as inline SVG (pilot) — per-part animation instead of whole-body motion
2. Payogotchi Home: demo-mode + static quests removed; actions pinned to bottom; pet re-centred
3. Pet Settings Journey stats made real (was static demo data)
4. Tutorial completion bug fixed (Level Up modal now actually fires) + made the XP one-time
5. NETS Points bridged for real: Payogotchi milestones now credit Yunen's real points balance;
   Payogotchi's own fake points counter removed; Total Activity now shows the real balance

---

## Recommended next steps, in priority order

1. **Commit today's changes and decide on the push/merge plan** (see the branch-status callout
   above) — nothing here is at risk, it's just not shared with the team yet.
2. **`awardPetProgress` hook for Yunen** — the one concrete two-way integration gap left; she's
   blocked on quest/challenge XP+cosmetic rewards until this exists.
3. **Cosmetics system** — needed for Yunen's cosmetic-reward ask, and is otherwise the last
   major unbuilt piece of Payogotchi itself.
4. Rig the remaining 6 characters the same way pink was done, one at a time with a visual check
   each — optional polish, not blocking anything.
