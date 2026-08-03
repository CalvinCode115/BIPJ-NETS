---
name: payogotchi-payment-bridge
description: Real NETS payments (QR pay + P2P transfers) now feed the pet via PetBridgeService; celebration queued for Payogotchi Home
metadata:
  type: project
---

**STATUS: IMPLEMENTED (2026-08-03), build green, live-verify pending.** Real payments now grow the pet (the live bridge that was deferred in [[payogotchi-demo-flow]] Phase 4).

Design — single seam, no pay UI touched:
- **`src/app/services/pet-bridge.service.ts`** (`PetBridgeService`, new, Calvin's domain): `record(amount, rawCategory, merchant)` maps the backend's free-text category → pet `TxnCategory` (`mapCategory`: meals→food, transit→transport, retail→shopping, else other; coffee/drinks stay 'other' to match the Home demo), calls `PetService.applyTransaction` (which persists to Firestore), and **queues a `PendingCelebration`**. `consumePending()` returns+clears it. `mergePending` preserves an earlier queued level-up/evolve/revive flag so the big popup isn't lost.
- **Hooks (one `tap` each, clearly commented "Payogotchi integration"):** `QrPaymentsService.payWithQr` (uses `res.payment` amount/category/merchant), `TransfersService.transfer` + `payReceiveQr` (via private `feedPet()`, generic 'other' spend, merchant = `To <name>`). Hooking the **services** (not pages) means every pay screen is covered automatically.
- **`payogotchi-home.page.ts`:** refactored the popup logic out of `runTransaction` into reusable `celebrate(result, merchant)`; new `ionViewWillEnter()` consumes the pending celebration and plays feedback→level-up→evolution when the user next opens the Payogotchi tab. Pet state/meters already reflect the payment immediately (live reference); the chain is the delight layer.

No DI cycle: qr/transfers → PetBridgeService → PetService → HttpClient/AuthService.

**Live-verify (needs backend + login):** log in as Alex, pay a QR merchant on the Pay tab, open Payogotchi → pet gained XP/points (food merchant also restores hunger) + celebration plays; confirm the same in `users/user_1/payogotchi/pet` (Firestore). See [[payogotchi-firestore-ready]], [[teammate-integration-state]].
