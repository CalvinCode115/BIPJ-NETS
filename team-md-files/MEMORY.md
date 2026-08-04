# Memory Index — every .md file in the repo, in reading order

Last compiled 2026-08-04. This lists **every** Markdown file in the project — root-level,
`team-md-files/`, whoever wrote it — grouped so a new reader (or a teammate catching up) can go
top to bottom and understand the whole project without hunting file by file. Within each group,
files are in the order it makes sense to read them.

---

## 0. Start here

1. **[README.md](../README.md)** *(repo root)* — clone/setup instructions, branch naming
   convention, and the tab → folder ownership map. First thing anyone new should read.
2. **[PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)** — how the actual Angular/Ionic + Node repo
   is laid out today: one folder per feature under `src/app/pages/`, who owns which, the shared
   `services/` directory, and (as of 4 Aug) a full breakdown of the `backend/` routes/services
   too. The most up-to-date "where do I find X" reference in the repo.

## 1. Cross-team architecture references (Jun Jie)

3. **[CORE-API-FOR-TEAMMATES.md](CORE-API-FOR-TEAMMATES.md)** — how to read transactions and
   User DNA from the shared backend without touching Firestore directly: endpoints, response
   shapes, demo logins, and what's explicitly *not* built yet for Rewards/Payogotchi to add.
4. **[guide.md](guide.md)** — deep dive on how "User DNA" (spending trait labels) and "Smart
   Insights" are actually computed — it's rule-based/threshold-based, not an LLM. Written for
   Eron's Travel Concierge but explains an engine several tabs share.

## 2. Feature overviews, one per owner

5. **[overview.md](overview.md)** — Calvin's original Payogotchi spec: the 3 meters (XP/Hunger/
   Happiness), the 8-egg system, the 21-screen list, the full user-flow diagrams, design system
   variables, and coding standards for the feature. The founding document for Payogotchi — still
   the reference for game-mechanic numbers (XP formulas, decay rates, egg trial rules).
6. **[rewards-system-overview (updated).md](../rewards-system-overview%20(updated).md)**
   *(repo root)* — Yunen's Rewards tab overview: the 7 screens (quests, challenges, marketplace,
   vouchers, points history, send-points), how points are earned/spent, and — importantly — the
   integration asks she's made of the rest of the team, including an unbuilt hook Payogotchi
   still owes her (`awardPetProgress`, see file #7 below).

## 3. Cross-team integration status (read this to know what's actually wired together)

7. **[teammate-integration-state.md](teammate-integration-state.md)** — current state of every
   teammate's feature and the concrete hooks between them and Payogotchi: what's bridged
   (real payments → pet, pet milestones → real NETS Points), what Yunen is still waiting on, and
   a full done/not-done checklist for Calvin's part. Also has the honest git branch/push status.
   **This is the most current cross-cutting doc — if anything below conflicts with it, trust
   this one.**

## 4. Payogotchi build history, in the order it was actually built

8. **[CLAUDE.md](CLAUDE.md)** — originally the AI-agent build brief (constraints, file
   ownership, Figma workflow) for building Payogotchi from scratch; has a "PROGRESS UPDATE — 23
   Jul" section appended documenting Phase 1/2 completion and what was still missing at that
   point (decay, fainted-state-as-route vs conditional render, etc). Historical — several items
   it lists as missing have since been resolved by later docs in this section.
9. **[payogotchi-phase1-persistence.md](payogotchi-phase1-persistence.md)** — Phase 1
   (localStorage persistence, `applyTransaction()` returning a `TransactionResult`) and Phase 2
   (the feedback → level-up → evolution modal chain) marked done.
10. **[payogotchi-demo-flow.md](payogotchi-demo-flow.md)** — decisions locked in for the 23 Jul
    demo deadline: two scripted scenarios (new user / returning user), deliberately **not**
    bridged to real payments yet at that point (demo buttons only) — superseded by
    [[payogotchi-payment-bridge]] below once the real bridge was built.
11. **[payogotchi-firestore-ready.md](payogotchi-firestore-ready.md)** — the pet's Firestore
    persistence: why it has to go through the Node backend (no Firebase client SDK on the
    frontend), and the actual `GET`/`PUT /api/users/:userId/payogotchi` implementation.
12. **[TECH-REVIEW-PREP.md](TECH-REVIEW-PREP.md)** — Calvin's prep notes for a technical review/
    viva: how to explain the whole app, trace a button click end-to-end, and likely gotcha
    questions (why localStorage, what stops XP farming, etc). Good primer even outside review
    prep — it's a clean explanation of the architecture in plain language.
13. **[payogotchi-payment-bridge.md](payogotchi-payment-bridge.md)** — real NETS payments (QR
    pay + P2P transfer) now feed the pet for real via `PetBridgeService`, replacing the demo
    buttons from [[payogotchi-demo-flow]]. Built 3 Aug.
14. **[updates.md](updates.md)** — Calvin's running dated changelog, most recent entry first.
    Currently covers 4 Aug: the pink Tapatchi SVG-rigging pilot, the Payogotchi Home demo/quests
    cleanup, real Journey stats on Pet Settings, the tutorial completion bug fix + one-time XP,
    and the NETS Points bridge to Yunen's real balance. **The most granular "what changed and
    why" record** — read this when [[teammate-integration-state]]'s summary isn't detailed enough.

## 5. Home / Pay / FX notes (Jun Jie)

15. **[14 Jul_MY_UPDATES.md](14%20Jul_MY_UPDATES.md)** — dated teammate update note: per-user FX
    currency tracking on Home, a backend fix so bank-card top-ups show up as a transaction on the
    source card, top-up/QR UX polish, and a full file-by-file guide to everything Jun Jie changed
    that session.
16. **[FX-CHANGES-FOR-TEAMMATE.md](FX-CHANGES-FOR-TEAMMATE.md)** — later, more focused FX fix:
    per-user card/balance storage keys so one account can't leak into another's currency
    exchange, backend card-ownership verification, and exchanges now creating real transaction
    records so they show up on Home/All Transactions.

---

## Not indexed above

- **This file** (`MEMORY.md`) — the index itself.
- Anything under `node_modules/` (third-party package READMEs/CHANGELOGs) — not project docs.
