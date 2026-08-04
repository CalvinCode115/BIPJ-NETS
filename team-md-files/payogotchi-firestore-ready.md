---
name: payogotchi-firestore-ready
description: Firestore persistence for the pet must go through the Node backend (frontend has no Firebase client SDK); backend path helper already exists
metadata:
  type: project
---

Key architecture finding for the lecturer's "real Firestore persistence" requirement:

- **The Angular frontend has NO Firebase client SDK** — only `firebase-tools` (CLI) in package.json and a `firebase` config block in `environment.ts`. It never talks to Firestore directly, and it uses backend-token auth (sessionStorage), NOT Firebase Auth. So `firestore.rules`' `allow write: if request.auth != null` is never satisfied client-side.
- **The Node/Express backend HAS `firebase-admin`** (`backend/firebase/admin.js` + `service-account.json`) and writes real Firestore. Admin SDK bypasses security rules.
- **The pet's Firestore home is already scaffolded:** `backend/db/firestore-paths.js` defines `userPayogotchiRef(db, userId)` → `users/{userId}/payogotchi`. The store layer `backend/db/firestore-store.js` has the read/write pattern (e.g. `getTransactions`/`addTransaction`, `getNotifications`) to copy.
- **There is NO payogotchi route in `backend/routes/api.js` yet** and NO get/save payogotchi function in the store.

**STATUS: IMPLEMENTED (2026-08-02), build green, live-verify pending.** What was built:
- `backend/db/firestore-store.js`: `getPayogotchiPet(userId)` / `savePayogotchiPet(userId, pet)` writing `users/{userId}/payogotchi/pet` (merge + `updatedAt`).
- `backend/routes/api.js`: `GET`/`PUT /api/users/:userId/payogotchi` (no getUser gate, so demo is robust for accounts not yet in Firestore).
- `src/app/services/pet.service.ts`: injects `HttpClient` + `AuthService`. **Per-user** — pet keyed on `ownerId = auth.userId ?? 'user_1'`. localStorage cache is namespaced `payogotchi_pet_<owner>`; the bare legacy `payogotchi_pet` is adopted once for `user_1` so the existing hand-built pet carries over. `save()` writes local instantly + **debounced (500ms)** Firestore PUT. New `syncFromCloud()` reconciles (cloud wins on load; if no cloud doc, promotes local). Handles account-switch via `loadedOwner` reset.
- `src/app/pages/payogotchi/payogotchi-entry.guard.ts`: now `async`, `await pet.syncFromCloud()` before intro-vs-home decision → returning user (Alex/user_1) never flashes intro; brand-new account → intro flow.

Design confirmed by user: **each user has their own Payogotchi** (new user → intro; Alex = existing level).

**Live-verify still to do (needs backend running + login):** start `backend` (port 3000) + `ng serve`, log in as Alex, make a txn, confirm `users/user_1/payogotchi/pet` doc in Firebase console; clear localStorage + refresh → reloads from Firestore; stop backend → still runs on cache. See [[payogotchi-phase1-persistence]], [[teammate-integration-state]].

Housekeeping: `service-account.json` IS git-ignored (good); `environment.ts` is tracked but its `apiKey` is a Firebase *web* client key (safe to ship, guarded by rules) — low severity.
