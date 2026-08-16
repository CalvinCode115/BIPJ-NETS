# Memory Index — the project's Markdown docs, in reading order

Last compiled 2026-08-16. Nine active docs, listed in the order it makes sense to read them.
Superseded docs were moved to [`archive/`](archive/) on 16 Aug — still in the repo and on
GitHub, just out of the way. They're listed at the bottom.

---

## 0. Start here

1. **[README.md](../README.md)** *(repo root)* — clone/setup instructions, branch naming
   convention, and the tab → folder ownership map. First thing anyone new should read.
2. **[PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)** — how the repo is laid out: one folder per
   feature under `src/app/pages/`, who owns which, the shared `services/` directory, and a full
   breakdown of `backend/` routes and services. The "where do I find X" reference.
3. **[COMMANDS.md](COMMANDS.md)** — npm and git command reference for this repo: every real
   script, the safe pull/push workflow, recovery recipes, and the branch-tracking gotcha.

## 1. Cross-team architecture references (Jun Jie)

4. **[CORE-API-FOR-TEAMMATES.md](CORE-API-FOR-TEAMMATES.md)** — how to read transactions and
   User DNA from the shared backend without touching Firestore directly: endpoints, response
   shapes, demo logins, and what's explicitly *not* built yet.
5. **[guide.md](guide.md)** — deep dive on how "User DNA" and "Smart Insights" are computed:
   rule-based and threshold-based, not an LLM. Written for Eron's Travel Concierge, but explains
   an engine several tabs share.

## 2. Current cross-team state — read these to know what's actually wired together

6. **[13Aug_Updates.md](13Aug_Updates.md)** — the three teammates' own summaries of their work,
   in their words: **Eron** (multi-currency travel payments, the `nets:travelPaymentCompleted`
   event, backend `/deduct` fix, itinerary and FX work), **Yunen** (points economy at 1pt/$1, the
   300/day + 20-txn + 5,000-balance caps, badges, vouchers, quest rebalancing), and **Jun Jie**
   (Home split into parent + `components/` + `services/`, honest transaction rewards, PayNow
   naming, `multi_currency.SGD` as balance truth). Jun Jie's **Part 3 is an explicit
   do-not-touch list**; Yunen's **Points Caps** section is a direct instruction to Payogotchi.
7. **[teammate-integration-state.md](teammate-integration-state.md)** — the live tracker: every
   teammate's state, the concrete hooks between them and Payogotchi, and the prioritised
   done/not-done checklist for Calvin's part. **Start here when picking up work.**

## 3. Payogotchi reference

8. **[overview.md](overview.md)** — the original Payogotchi spec: the 3 meters (XP/Hunger/
   Happiness), the 8-egg system, the screen list, user-flow diagrams, design-system variables and
   coding standards. Still the reference for game-mechanic numbers.
9. **[updates.md](updates.md)** — Calvin's running dated changelog, most recent first. The most
   granular "what changed and why" record — read it when the tracker's summary isn't detailed
   enough.

---

## Archive

Moved to [`archive/`](archive/) on 16 Aug: superseded, finished, or folded into the docs above.
Nothing was deleted — these are still tracked by git and visible on GitHub.

| File | Why it was archived |
|---|---|
| `CLAUDE.md` | Original AI build brief + 23 Jul progress log; superseded by the tracker |
| `payogotchi-phase1-persistence.md` | Phase 1/2 completion notes; long since done |
| `payogotchi-demo-flow.md` | Demo-button era, replaced by the real payment bridge |
| `payogotchi-payment-bridge.md` | Folded into the tracker |
| `payogotchi-firestore-ready.md` | Pet persistence design, now described in the tracker |
| `TECH-REVIEW-PREP.md` | Prep notes for the July technical review |
| `14 Jul_MY_UPDATES.md` | Jun Jie, July; superseded by `home_updates_9 Aug` and 13 Aug |
| `home_updates_9 Aug.md` | Jun Jie; the long-form version of the Home split |
| `FX-CHANGES-FOR-TEAMMATE.md` | Eron/Jun Jie FX fixes, since folded into 13 Aug |
| `rewards-changelog-aug9-11.md` | Yunen; reproduced almost verbatim inside 13 Aug |
| `quests-challenges-vouchers-reference.md` | Yunen; the full quest/challenge/voucher catalog |
| `rewards-system-overview (updated).md` | Yunen's Rewards tab overview *(was at repo root)* |

**Note:** the last six belong to teammates. They were archived as part of a repo tidy-up, not
because anyone finished with them — worth a heads-up to Jun Jie, Yunen and Eron.

---

## Not indexed

- **This file** (`MEMORY.md`) — the index itself.
- Anything under `node_modules/`, `www/`, or the Python `.venv` — not project docs.
