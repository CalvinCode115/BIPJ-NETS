# Home feature — structure & refactor notes

This document explains how the Home tab is organised after the parent–child / services split, **and** the Home-owned feature / bugfix updates that sit on top of that structure.

---

## Why we split

Previously most Home UI and logic lived in one large page (`home.page.ts` / `.html` / `.scss`). That made the file hard to review, explain in a viva, and change safely.

The goal was **not** to remove features. It was to give each concern its own file:

| Concern | Where it lives now |
|---|---|
| Screen layout & orchestration | `home/home/` (the page) |
| Visible UI blocks | `home/components/` |
| Data / API / mapping helpers | `home/services/` |
| Full screens opened from Home | other `home-*` folders |

---

## Folder map

```
src/app/pages/home/
├── home/                         ← main Home tab (parent / coordinator)
│   ├── home.page.ts
│   ├── home.page.html
│   ├── home.page.scss
│   ├── home.module.ts            ← declares page + Home components
│   └── home-routing.module.ts
│
├── components/                   ← child UI used ON the Home screen
│   ├── home-card-carousel/
│   ├── home-quick-actions/
│   ├── home-currencies/
│   ├── home-insight-card/
│   ├── home-spending-summary/
│   ├── home-recent-transactions/
│   ├── home-rewards-card/
│   ├── home-secondary-actions/
│   ├── home-add-card-modal/
│   ├── home-top-up-modal/
│   └── home-notifications-modal/
│
├── services/                     ← logic without templates
│   ├── home-wallet.service.ts
│   ├── home-activity.service.ts
│   ├── home-top-up.service.ts
│   └── home-alerts.service.ts
│
├── home-more/                    ← separate pages (navigate TO these)
├── home-qr-code/
├── home-all-transactions/
├── home-ai-insights/
├── home-full-report/
├── home-notifications/           ← Notifications Guide / settings (not the bell modal)
├── home-card-management/
├── home-app-settings/
└── home-security-privacy/
```

**Do not delete** `components/` or `services/` — the main page depends on them.  
**Do not confuse** `home-notifications/` (settings page) with `home-notifications-modal/` (bell popup on Home).

---

## Parent–child pattern

Home uses Angular **parent → child** composition.

- **Parent:** `HomePage` (`home/home/home.page.*`)
  - Owns selected card, wallet map, modal open flags
  - Calls services to load data
  - Handles navigation and “what happens after” (e.g. card linked → refresh activity)

- **Children:** `app-home-*` components under `components/`
  - Receive data with `@Input()`
  - Notify the parent with `@Output()` events
  - Own their own HTML + SCSS (and local UI helpers)

Example from the page template:

```html
<app-home-spending-summary
  [monthlySummary]="monthlySummary"
  [spendingCategories]="spendingCategories"
  [spendingPeriod]="spendingPeriod"
  [periodButtonLabel]="spendingPeriodButtonLabel"
  (openFullReport)="openFullReport()"
  (openPeriodSheet)="toggleSpendingPeriodMenu()">
</app-home-spending-summary>
```

- `[property]="..."` → parent passes data **down**
- `(event)="..."` → child asks parent to **act**

Flow sketch:

```
User on Home tab
    → home.page (parent)
        → components (UI blocks)
        → services (API / mapping)
    → navigate to home-more / home-qr-code / …
```

---

## What each service does

| Service | Responsibility |
|---|---|
| `home-wallet.service` | Load wallet cards, persist selection / SGD snapshot, currency balances, replace card after updates |
| `home-activity.service` | Card spending dashboard, recent txn mapping, overall insight teaser |
| `home-top-up.service` | Build funding options, validate top-up, call top-up API |
| `home-alerts.service` | Notification list helpers, login-alert queue / dismiss timers |

Shared display helpers (used by Home and elsewhere) also live under `src/app/utils/` (e.g. `notification-display.ts`, `card-display.ts`, `wallet-topup.ts`). Those are not Home-only.

---

## What each main component shows

| Component | UI |
|---|---|
| `home-card-carousel` | Card face, add-card slide, dots, sensitive toggle |
| `home-quick-actions` | Pay / Top Up / QR / More |
| `home-currencies` | Multi-currency wallet list + Exchange |
| `home-insight-card` | DNA traits + insight teaser |
| `home-spending-summary` | Month totals + spending bars |
| `home-recent-transactions` | Recent list + See all |
| `home-rewards-card` | NETS Points + Payogotchi XP teaser |
| `home-secondary-actions` | Shortcut grid |
| `home-add-card-modal` | Link / generate card form |
| `home-top-up-modal` | Top-up amount + funding |
| `home-notifications-modal` | Bell notification list |

---

## What still lives on `home.page.ts`

The page is intentionally still a **coordinator** (not empty):

- Lifecycle (`ionViewWillEnter` / leave)
- Which account tab / slide is active (`currentCard`)
- Opening / closing modals and handling completed events
- Reloading card activity after card change / top-up / link
- Low-balance banner decision
- FX / travel window event listeners
- Routing to other Home subpages

Approximate sizes after the split (order of magnitude):

| File | Role |
|---|---|
| `home.page.ts` | ~700 lines — orchestration |
| `home.page.html` | ~200 lines — composition |
| `home.page.scss` | ~450 lines — page chrome only |

Further thinning is optional (e.g. move travel/FX listeners into another service).

---

## Feature updates (Home ownership)

These are product / bugfix updates on the Home side of the app (in addition to the structure refactor above). They are what the Home owner should be able to explain in a demo or viva.

### Wallet & balance (SGD as source of truth)

- Card funds for spend / top-up / “balance left” messaging use **`multi_currency.SGD`**, not a legacy top-level `balance` field.
- Fixed cases where the UI showed funds but pay failed (or showed **`$NaN`**) because older helper code still read `card.balance`.
- Relevant backend: `backend/services/card-utils.js`, `backend/services/balance-message.js`.
- Home wallet loading / currency chips go through `home-wallet.service` and the **Your Currencies** block (`home-currencies`).

### NETS Rewards + Payogotchi XP on Home

- Home rewards card shows **NETS Points** and, when the pet is onboarded, a **Payogotchi XP** bar (level / stage / progress) using `PetService` + `PointsService`.
- Now lives in `components/home-rewards-card/`.
- If the user has **not** hatched / onboarded yet, Home shows an **XP teaser** (empty bar + prompt to hatch) that navigates to the Payogotchi tab — so new users still see the XP concept without a fake filled bar.

### More profile (`home-more`)

- Replaced the old static “Silver Tier” style label with live **`pts | XP`** from `PointsService` + `PetService`, so More stays consistent with the Home rewards card.

### Currencies UX on Home

- Kept **Your Currencies** (real multi-currency balances + Exchange).
- Removed the confusing **“Balance in other currencies”** SGD FX preview panel that looked like a second wallet and fought the real balances list.

### Notifications

- Bell modal on Home lists notifications (`home-notifications-modal` + `home-alerts.service`).
- Support for **`points_received`** (when someone sends you NETS Points): backend creates the notification; Home / notifications guide format amount, icon, and title appropriately.
- Login alert banners can surface unread transfer / points notifications on enter.
- **Low balance reminder** on Home (below $50 on eligible prepaid/CashCard) with soft dismiss for the visit; permanent preference remains on the Notifications Guide page (`home-notifications`).

### Transactions

- Recent list and See all (`home-all-transactions`) show clearer txn rows (including points/XP display estimates where relevant).
- Transaction date/time presentation on Home / See all was aligned so meta lines are readable for the user.

### Top-up & pay gates on Home

- Top-up modal extracted but behaviour unchanged: whole-dollar amounts, funding options, wallet limit checks via `home-top-up.service`.
- Quick actions still gate **Pay / QR** for CashCard (transit-only) and **Top Up** when the card cannot be topped up manually.

---

## Change summary

### A. Structure refactor

#### Added

- `src/app/pages/home/components/**` — presentational / modal components listed above  
- `src/app/pages/home/services/**` — wallet, activity, top-up, alerts  
- Shared util usage for notification display formatting on Home  
- This doc: `HOME-STRUCTURE.md`

#### Changed (structure)

- `home/home/home.page.ts` — reduced to wiring + orchestration; modal/form/chart UI logic moved out  
- `home/home/home.page.html` — uses `<app-home-*>` tags instead of large inline blocks  
- `home/home/home.page.scss` — styles for extracted blocks moved into component SCSS  
- `home/home/home.module.ts` — declares the new components  

#### Unchanged (by design)

- Other Home routes (`home-more`, `home-qr-code`, etc.) remain separate pages  
- Pay / Payogotchi **folders** were not refactored in this Home split (Home only **reads** pet/points services for the rewards teaser)  

### B. Feature / fix updates (see section above)

| Area | What changed |
|---|---|
| Wallet truth | SGD / `multi_currency` fixes; no false insufficient-balance / `$NaN` from legacy `balance` |
| Rewards card | Points + XP (or hatch teaser) on Home |
| More | Live pts \| XP |
| Currencies | Your Currencies kept; FX preview panel removed |
| Notifications | `points_received` + low-balance reminder UX |
| Transactions | Clearer recent / See all presentation |

---

## How to work in this folder (team tips)

1. **Changing how a block looks** → edit that component’s `.html` / `.scss` under `components/`.  
2. **Changing API / mapping** → edit the relevant file under `services/`.  
3. **Changing when something opens or reloads** → edit `home.page.ts`.  
4. **Adding a new block on Home** → new component folder → declare in `home.module.ts` → place tag in `home.page.html`.  
5. After structural edits, run a development build and smoke-test: card swipe, add card, top-up, notifications bell, spending period, See all.

---

## Viva one-liners

**Structure**

> Home uses a parent page that wires child components for each UI section, and Home services for wallet/activity/top-up/alerts, so each file owns one concern instead of one giant page file.

**Ownership / features**

> Home owns the wallet surface, spending activity, rewards + XP teaser, currencies list, and notification entry points — with SGD multi-currency as the balance source of truth and clear separation between NETS Points and Payogotchi XP.
