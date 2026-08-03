---
name: teammate-integration-state
description: State of teammates' features and the concrete hook points for integrating Payogotchi with payment/rewards/travel
metadata:
  type: project
---

Snapshot (2026-08-02) of teammates' parts, for integrating Payogotchi:

- **App has 6 tabs** (not 5): home, pay, travel, fx-tracker, rewards, payogotchi (`src/app/tabs/tabs-routing.module.ts`).
- **JunJie — Payment (mature):** QR pay = `POST /api/users/:userId/payments/qr` (`qr-payments.service.ts`), P2P = `POST /api/users/:userId/transfers` (`transfers.service.ts`). Both write real Firestore transactions via `backend/routes/api.js`. **These are the natural hook points** for the pet to react to REAL spending (replacing the demo buttons). Currently Payogotchi is demo-only and NOT bridged — see [[payogotchi-demo-flow]].
- **Yunen — Rewards (NOT built):** `src/app/rewards/rewards.page.html` is an empty shell (header + empty `<ion-content>`, ~15 lines); `rewards.page.ts` is a bare class. The "most important Rewards NETS page" barely exists yet. Payogotchi already mints `netsPoints` (10% of base XP) — a natural feed into a rewards/points wallet once Yunen builds it, or Calvin could build a minimal rewards page consuming `PetService.state.netsPoints`.
- **Eron — Travel (mature):** `travel.service.ts` (~488 lines) calls the Python FastAPI on `http://localhost:8000` (Places/photos) AND the Node backend on `:3000` (DNA profile). Real, working feature. Least overlap with Payogotchi.

**Integration priority order that makes sense:** (1) real transaction → pet bridge (JunJie) is the highest-value, most demo-able; (2) netsPoints → rewards (Yunen) is blocked on Yunen's page; (3) travel (Eron) has little to gain.

Memory's updated. Here's the full consolidated picture, grounded in the actual code I just read through.

---
BIPJ-NETS — Consolidated Project

Where we left off (your Payogotch

Your feature is in good shape and code:
- PetService (src/app/services/pet.service.ts) is the single source of truth — all game rules
(XP, daily caps, happiness multipETS points) live here.applyTransaction() returns a TransactionResult.
- Persistence today = localStoragave() after every mutation, load()in constructor).
- Celebration chain (Feedback → L inline modals on the home page.
- Onboarding is guarded (payogotchi-entry.guard.ts, onboarded flag) with new-user and
returning-user demo seeds.
- Nothing outside Payogotchi touches PetService — it's cleanly isolated (which is good news for
integration).

The lecturer's requirement: real

This is very achievable — most of The key finding:

┌────────────────┬──────────────────────────────────────────────┐
│     Layer      │                                  Reality                                  │
├────────────────┼──────────────────────────────────────────────┤
│ Angular        │ Has Firebase config in environment.ts but no Firebase client SDK          │
│ frontend       │ installed. Autorage), not Firebase Auth. So  │
│                │ the frontend can't (and shouldn't) write Firestore directly.              │
├────────────────┼──────────────────────────────────────────────┤
│ Node/Express   │ Already has firebase-admin + service-account.json and writes real         │
│ backend        │ Firestore.                                   │
├────────────────┼───────────────────────────────────────────────────────────────────────────┤
│ Firestore      │ Already scaffoths.js defines                 │
│ schema         │ userPayogotchiRef → users/{userId}/payogotchi.                            │
├────────────────┼──────────────────────────────────────────────┤
│ Missing        │ No payogotchi route in backend/routes/api.js and no get/save function in  │
│                │ firestore-stor                               │
└────────────────┴───────────────────────────────────────────────────────────────────────────┘

The correct approach (matches your tech-review "swap the storage layer, screens untouched"
story):
1. Add getPayogotchiPet(userId) / savePayogotchiPet(userId, pet) to firestore-store.js.
2. Expose GET/PUT /api/users/:use
3. Change PetService.save()/load() to call those via HttpClient, keyed by AuthService.userId.
4. Keep localStorage as an offlinbreaks offline and the demo staysreliable).

This satisfies "actual persistence on Firestore" honestly — the data really lands in Firestore
under the shared user hub — whileeens.

Teammates' parts & integration st

Person: JunJie
Feature: Payment (QR + P2P)
State: Mature. QR = POST /api/usefers = POST
/users/:userId/transfers; both write real Firestore transactions.
Integration point for you: Highesl hooks to make the pet react to
real spending instead of demo buttons.
─────────────────────────────────
Person: Yunen
Feature: Rewards ("most important
State: Barely built. rewards.page.html is an empty shell (~15 lines, empty <ion-content>);
rewards.page.ts is a bare class.
Integration point for you: You already mint netsPoints (10% of base XP) — a natural feed into a
points/rewards wallet, but this ithe page (or you build a minimal
one).
─────────────────────────────────
Person: Eron
Feature: AI Travel Concierge
State: Mature. ~488-line service hitting the Python FastAPI (:8000) + Node (:3000).
Integration point for you: Least i to gain here.

(The app is actually 6 tabs: homewards, payogotchi.)

Current problems / undone parts

1. Payogotchi persistence is loca lecturer's explicit ask. (fixable, plan above)
2. Payogotchi is demo-only, not bl QR/transfer payments don't affect the pet yet (this was a deliberate deadline decision, now worth revisiting).
3. Rewards page (Yunen) is essenttant" page barely exists;integration there is blocked.
4. Housekeeping risk: environmentAPI key committed to the repo, andthere's a service-account.json in the backend — check these are git-ignored before any push.
5. Cruft: duplicated security stuhe folders, .BACKUP files intravel, redundant old route-pages (level-up, stage-evolution) — cleanup candidates.

My recommended order

1. Firestore persistence for the pet (your requirement — do this first, ~self-contained).
2. Bridge real transactions → pet the review and reuses the samebackend user hub.
3. NETS points → rewards only if  a minimal rewards page consumingnetsPoints).
