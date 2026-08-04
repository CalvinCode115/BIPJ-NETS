# Project Structure

How the Angular/Ionic app is laid out, who owns what, and where a new page goes.

Every feature lives in exactly one folder under `src/app/pages/`. Open that
folder and you see the whole feature: its shell, its routing, and all of its
sub-pages. Nothing belonging to a feature lives anywhere else.

> Last verified against the tree on 4 Aug 2026. Frontend folder layout unchanged since
> the `pages/` consolidation (3 Aug); a **Backend** section was added below since Payogotchi's
> NETS Points bridge (4 Aug) added the first backend files owned by Calvin.

---

## Ownership at a glance

| Owner | Feature | Folder | Route |
|---|---|---|---|
| **Calvin** | Payogotchi | `src/app/pages/payogotchi/` | `/tabs/payogotchi` |
| **Eron** | Travel (incl. FX Tracker) | `src/app/pages/travel/` | `/tabs/travel` |
| **Jun Jie** | Home | `src/app/pages/home/` | `/tabs/home` |
| **Jun Jie** | Pay | `src/app/pages/pay/` | `/tabs/pay` |
| **Yunen** | Rewards | `src/app/pages/rewards/` | `/tabs/rewards` |
| *shared* | Login / Signup | `src/app/login-signup/` | `/login`, `/signup` |

FX Tracker is Eron's and sits inside Travel (`pages/travel/fx-tracker/`)
because it is a Travel sub-feature, not a tab of its own.

Login/Signup deliberately stays outside `pages/` — it is not a tab, it wraps
the tab shell via `app-routing.module.ts`.

---

## The standard page folder

Almost every page folder holds the same five files. Read `<name>` as the
folder name:

```
<name>/
├── <name>-routing.module.ts   route + child routes for this page
├── <name>.module.ts           NgModule, declares the page
├── <name>.page.html           template
├── <name>.page.scss           styles
└── <name>.page.ts             component
```

Ten folders also carry a generated `<name>.page.spec.ts` — all eight under
`rewards/`, plus `home/home/` and `pay/pay/`. Only `fx-tracker/` deviates
further, adding a `.model.ts` and `.service.ts`.

The tree below therefore lists **folders**, since the five files above are
implied. Files are spelled out wherever a folder breaks the pattern.

---

## src/app/pages/

### payogotchi/ — Calvin

Shell files sit at the top; the 22 screens are folders beneath it.

```
pages/payogotchi/
├── payogotchi.page.ts / .html / .scss    tab shell (container)
├── payogotchi.module.ts
├── payogotchi-routing.module.ts          routes to all 22 screens
├── payogotchi-entry.guard.ts             sends you to egg-selection if no pet
│
├── account-settings/
├── cosmetic-purchase-modal/
├── cosmetics-dressup/
├── egg-reselection-penalty/
├── egg-reselection-trial/
├── egg-selection/
├── egg-swap-modal/
├── fainted-pet/
├── hatching-animation/
├── hatching-progress/
├── how-payogotchi-works/
├── level-up/
├── mini-game/
├── naming-screen/
├── payogotchi-home/
├── payogotchi-intro/
├── pet-settings/
├── rename-pet/
├── stage-evolution/
├── tapatchi-tutorial/
├── transaction-feedback/
└── welcome-back/
```

### travel/ — Eron

```
pages/travel/
├── travel.page.ts / .html / .scss
├── travel.module.ts
├── travel-routing.module.ts
├── travel.model.ts                       Travel-specific types
├── travel.service.ts                     itinerary / destinations
├── weather.service.ts                    weather lookup
├── travel.page.ts.BACKUP                 dead file — safe to delete
├── travel.page.html.BACKUP               dead file — safe to delete
│
└── fx-tracker/
    ├── fx-tracker.page.ts / .html / .scss
    ├── fx-tracker.module.ts
    ├── fx-tracker-routing.module.ts
    ├── fx-tracker.model.ts
    └── fx-tracker.service.ts             FX rates + history
```

### home/ — Jun Jie

No shell of its own; `home/home/` is the tab landing page and the rest are
screens you push onto it.

```
pages/home/
├── home/                                 the Home tab landing page
├── home-ai-insights/
├── home-all-transactions/
├── home-app-settings/
├── home-card-management/
├── home-full-report/
├── home-more/
├── home-notifications/
├── home-qr-code/                         QR scan + my-QR, voucher eligibility
└── home-security-privacy/
```

### pay/ — Jun Jie

```
pages/pay/
├── pay/                                  the Pay tab landing page
└── pay-scan-qr/                          QR scan-to-pay flow
```

### rewards/ — Yunen

Shell at the top, eight reward screens beneath. All eight are nested under
the `rewards` tab in `tabs-routing.module.ts` so they keep the tab bar.

```
pages/rewards/
├── rewards.page.ts / .html / .scss        tab shell
├── rewards.module.ts
├── rewards-routing.module.ts
│
├── daily-quests/
├── my-vouchers/
├── nets-points/                          points balance + history
├── partner-challenges/
├── point-history/
├── rewards-marketplace/
├── send-points/
└── weekly-quests/
```

---

## Everything outside pages/

Shared infrastructure. None of this belongs to a single feature.

```
src/app/
├── pages/              all five features (above)
├── login-signup/       login/ and signup/ — auth, outside the tab shell
├── tabs/               tab bar shell + tabs-routing.module.ts
├── services/           all HTTP/state services (see below)
├── components/         reusable UI components
├── shared/             SharedModule + nets-logo component
├── utils/              pure helper functions, no Angular deps
├── core/               api.config.ts (API_BASE_URL)
├── guards/             auth.guard.ts
├── models/             cross-feature types
└── explore-container/  Ionic starter leftover
```

### services/

One home for every service. Yunen's rewards services were merged in here
from the old root-level `shared/` folder.

| Group | Files |
|---|---|
| Auth & session | `auth.service.ts`, `session.service.ts` |
| Cards | `cards.service.ts`, `card-context.service.ts`, `card-linked-exchange.service.ts` |
| Money movement | `transfers.service.ts`, `transactions.service.ts`, `qr-payments.service.ts`, `receipts.service.ts` |
| FX / currency | `exchange.service.ts`, `multi-currency.service.ts`, `currency.config.ts`, `country-data.service.ts`, `destination.config.ts` |
| Payogotchi | `pet.service.ts`, `pet-bridge.service.ts` |
| Rewards (Yunen) | `points.service.ts`, `points.models.ts`, `points-transfer.service.ts`, `points-transfer.models.ts`, `my-vouchers.service.ts`, `my-vouchers.models.ts`, `marketplace.service.ts`, `marketplace.models.ts`, `daily-quests.service.ts`, `weekly-quests.service.ts`, `partner-challenges.service.ts`, `quest-event.service.ts`, `quest.models.ts`, `daily-checkin.service.ts`, `daily-checkin.models.ts` |
| Misc | `cache.service.ts`, `saved-contacts.service.ts`, `notifications.service.ts`, `api-contract.ts` |

---

## backend/

The Node/Express API (`backend/server.js`, port 3000) that every tab's frontend services call
through `/api`. Firestore via `firebase-admin` is the real datastore; there's a SQLite fallback
for local dev (`backend/db/sqlite.js`).

```
backend/
├── server.js
├── routes/             one file per feature area, all mounted into api.js
│   ├── api.js           the main router — auth, cards, transactions, payments,
│   │                    transfers, insights/DNA, Payogotchi pet GET/PUT + milestone-bonus
│   ├── auth.js
│   ├── points.js                    Yunen — GET points/balance, GET points/history (read-only)
│   ├── points-transfer.js           Yunen — send-points-to-friend
│   ├── quests.js                    Yunen — daily/weekly quests, partner challenges, claiming
│   ├── marketplace.js               Yunen — rewards marketplace / voucher redemption
│   ├── my-vouchers.js               Yunen — voucher wallet + auto-apply at QR payment
│   └── daily-checkin.js             Yunen — daily check-in streak/reward
│
├── services/           business logic, one file per concern
│   ├── dna.js, insight-engine.js, insight-deep-dives.js,     } Jun Jie — DNA/Insights
│   │   merchant-tags.js, top-spots.js                        } engine (see guide.md)
│   ├── qr-payment.js, p2p-transfer.js, card-utils.js,        } Jun Jie — payments/cards
│   │   wallet-config.js, credit-config.js, spending-rules.js,}
│   │   balance-message.js, name-mask.js                      }
│   ├── transaction-rewards.js       Yunen — 10 NETS Points per $1 on every real merchant
│   │                                spend (QR payments only, not transfers/top-ups);
│   │                                writes users/{userId}.points + a pointsLedger entry
│   ├── payogotchi-rewards.js        Calvin (NEW, 4 Aug) — awards a NETS Points bonus for a
│   │                                Tapatchi level-up/evolution milestone, into the SAME
│   │                                points balance/ledger transaction-rewards.js writes to
│   ├── points.js, points-transfer.js, quests.js, marketplace.js,
│   │   my-vouchers.js, daily-checkin.js, notifications.js    } Yunen — Rewards backend
│   └── nets-simulator.js, receipt-simulator.js, period.js     } shared/demo helpers
│
├── db/
│   ├── firestore-store.js           read/write functions per collection
│   ├── firestore-paths.js           collection-path helpers (single source of truth
│   │                                for Firestore layout — see the comment at its top)
│   └── sqlite.js                    local dev fallback
│
├── firebase/
│   ├── admin.js                     firebase-admin init (service-account.json, git-ignored)
│   └── service-account.json         git-ignored — ask the team lead for a copy
│
└── data/                merchant/voucher/quest seed catalogs
```

**Payogotchi's only backend footprint** is `services/payogotchi-rewards.js` plus the pet
GET/PUT and `POST /users/:userId/payogotchi/milestone-bonus` routes in `routes/api.js` — no
other backend file belongs to Calvin. The pet itself is still client-authoritative (its own
state lives in `users/{userId}/payogotchi/pet`, written wholesale by the client); only the
**NETS Points bonus** for a level-up/evolution goes through a real backend write, because that
touches the shared points balance/ledger Yunen's `points.js` reads from.

---

## Import conventions

Two styles are in use and both resolve, because `tsconfig.json` sets
`baseUrl: "./"`:

```ts
import { AuthService } from '../../../services/auth.service';   // relative
import { PointsService } from 'src/app/services/points.service'; // repo-root
```

Prefer **relative** paths within a feature and **repo-root** paths when
reaching across features. Note the depth: a file in
`pages/rewards/nets-points/` is three levels below `src/app/`, so shared code
is `../../../services/…`.

There are two different "shared" things — don't confuse them:

- `src/app/shared/` — the Angular `SharedModule` and the nets-logo component.
- The old root-level `shared/` — **gone**, merged into `src/app/services/`.

## API base URL

Two conventions currently coexist, both reaching the same backend:

- `API_BASE_URL` from `src/app/core/api.config.ts` is `'/api'` — relative,
  forwarded by `proxy.conf.json` to `localhost:3000`.
- Yunen's rewards services use `environment.apiUrl`, which is the absolute
  `http://localhost:3000/api` — bypasses the proxy, works because the backend
  enables CORS.

Worth unifying on `API_BASE_URL` at some point; not urgent.

---

## Adding a new page

1. Generate it inside the owning feature:
   `ionic g page pages/<feature>/<new-page>`
2. Register it in that feature's `<feature>-routing.module.ts` — or, for a
   screen that must keep the tab bar, in `src/app/tabs/tabs-routing.module.ts`.
3. Keep feature-only services in the feature folder; anything a second
   feature imports belongs in `src/app/services/`.

## Moving a page

Use `git mv` so history follows the file, then fix the import depth in the
moved file **and** in everything that imported it — including the lazy
`loadChildren: () => import('…')` strings in the routing modules, which the
compiler does check. `ng build` catches every miss.
