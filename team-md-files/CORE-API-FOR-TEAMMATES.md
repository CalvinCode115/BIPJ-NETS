# Core API Guide — For Payogotchi & Rewards Teammates

This guide explains what the **Core team (Jun Jie)** has built so you can read **transactions**, **amounts**, and **User DNA** without touching the database directly.

> **Rule:** Do not call Firestore from the frontend. Use the shared HTTP APIs and Angular services below.

**Related docs:**
- `TEAM-SETUP-GUIDE.md` — clone, Firebase key, `npm start`, demo login
- `guide.md` — deep dive on how User DNA is computed (same engine applies here)
- `src/app/services/api-contract.ts` — shared TypeScript types

---

## How data flows

```
Your tab page (rewards/ or payogotchi/)
        │
        ▼
src/app/services/*.ts          ← call these from your component
        │
        ▼
GET /api/users/:userId/...     ← Express backend (backend/routes/api.js)
        │
        ▼
Firestore: users/{userId}/transactions/{txnId}
```

User DNA is **not stored in its own table**. It is **recomputed on every API call** from transaction history.

---

## 1. Your tab folders (where to work)

Each tab has its own folder. Work only in yours:

| Tab | Your folder | Route |
|-----|-------------|-------|
| **Rewards** | `src/app/pages/rewards/` | `/tabs/rewards` |
| **Payogotchi** | `src/app/pages/payogotchi/` | `/tabs/payogotchi` |

Shared code you may **import** (read-only unless coordinated with Core):

| What | Path |
|------|------|
| Transaction HTTP client | `src/app/services/transactions.service.ts` |
| Auth / logged-in user | `src/app/services/auth.service.ts` |
| Shared TypeScript types | `src/app/services/api-contract.ts` |
| API base URL | `src/app/core/api.config.ts` → `/api` |

Do **not** edit Home, Pay, or Travel folders without asking Core first.

### Firestore layout (read-only context)

```
users/{userId}                         ← profile (tier, points)
users/{userId}/transactions/{txnId}    ← shared spend (Core owns writes)
users/{userId}/rewards/{id}            ← YOUR Rewards data (your team writes)
users/{userId}/payogotchi/{id}         ← YOUR Payogotchi data (your team writes)
```

Core maintains **transactions**. Your team owns **`rewards`** and **`payogotchi`** subcollections — coordinate with Core before adding backend routes for those.

---

## 2. How to get the logged-in user

After login, always use the real user id — never hardcode `user_1`.

```typescript
import { AuthService } from '../services/auth.service';

constructor(private authService: AuthService) {}

ngOnInit() {
  const userId = this.authService.userId; // e.g. "user_1"
  if (!userId) return; // not logged in
}
```

**Demo logins** (PIN `123456` for all):

| Name | Phone | User ID |
|------|-------|---------|
| Alex Tan | `91234567` | `user_1` |
| Sarah Lim | `87654321` | `user_2` |
| Cheng | `80680505` | `user_3` |
| Adam | `84688331` | `user_4` |

Alex has the richest transaction history for DNA testing.

---

## 3. Monthly period (MTD)

There is no separate “MTD” endpoint. Spending is filtered by **calendar month** using `month` and `year` query params.

| Concept | How it works |
|---------|--------------|
| Default period | Current month + year (Singapore timezone) |
| Filter logic | `backend/services/period.js` → `parsePeriod()`, `filterByMonth()` |
| Month picker data | `availablePeriods` in transaction/insights responses |

```typescript
// June 2026
{ month: 6, year: 2026 }
```

> **Note:** This returns the **full calendar month**, not “1st of month through today”. For true month-to-date, ask Core to add it.

---

## 4. Retrieve transactions (id, amount, and more)

### API endpoint

```
GET /api/users/:userId/transactions?month=6&year=2026
```

### Optional filters

| Query param | Values | Effect |
|-------------|--------|--------|
| `month`, `year` | `1–12`, e.g. `2026` | Filter to that month |
| `search` | text | Merchant/category search |
| `type` | `income` \| `expenditure` | Credits vs debits |
| `category` | e.g. `Coffee`, `Dining` | Exact category |
| `cardId` | card id string | One card only |
| `cardType` | `prepaid` \| `cashcard` \| `others` | Card group |

### Transaction fields you get back

Each item in `transactions[]`:

| Field | Type | Meaning |
|-------|------|---------|
| **`id`** | `string` | **Transaction id** — use this as the transaction number (e.g. `txn_a_j2`, `txn_1712345678`) |
| **`amount`** | `number` | Signed amount. **Negative = money out**, **positive = money in** |
| `merchant` | `string` | Store / payee name |
| `subtitle` | `string` | Extra label (e.g. "Receipt scan", "From Alex") |
| `date` | `string` | Display date (`en-SG`) |
| `time` | `string` | Display time |
| `type` | `'debit' \| 'credit'` | Transaction direction |
| `category` | `string` | e.g. `Coffee`, `Dining`, `Transfer` |
| `cardId` | `string?` | Card used |
| `icon`, `iconColor` | `string` | UI metadata |
| `counterparty` | `object?` | Transfer rows only (`direction`, `phone`, `name`) |

> There is **no separate `transactionNumber` or `refNo` field**. Use **`id`**.
>
> `transferId` appears only on **transfer / QR receive create** responses (not in list responses).

### Full response shape

```json
{
  "transactions": [
    {
      "id": "txn_a_j2",
      "merchant": "Starbucks Raffles Place",
      "subtitle": "NETS FlashPay",
      "amount": -6.5,
      "date": "3 Jun",
      "time": "8:15 am",
      "type": "debit",
      "category": "Coffee",
      "cardId": "card_1",
      "icon": "cafe",
      "iconColor": "#2f80ed"
    }
  ],
  "summary": {
    "month": "2026-06",
    "monthLabel": "June 2026",
    "totalSpending": 412.5,
    "transactionCount": 28,
    "avgPerDay": 13.75
  },
  "availablePeriods": [{ "month": 6, "year": 2026, "label": "June 2026" }],
  "selectedPeriod": { "month": 6, "year": 2026, "label": "June 2026" }
}
```

### Frontend — use `TransactionsService`

```typescript
import { TransactionsService } from '../services/transactions.service';
import { AuthService } from '../services/auth.service';

constructor(
  private transactionsService: TransactionsService,
  private authService: AuthService,
) {}

loadTransactions() {
  const userId = this.authService.userId!;
  this.transactionsService.getTransactions(userId, {
    month: 6,
    year: 2026,
    type: 'expenditure', // optional: only spending out
  }).subscribe((response) => {
    for (const txn of response.transactions) {
      const txnId = txn.id;       // transaction number
      const amt = txn.amount;     // negative = spent
      const spent = Math.abs(txn.amount);
    }
    const totalSpent = response.summary.totalSpending;
  });
}
```

Full TypeScript shape: `TransactionRecord` in `src/app/services/transactions.service.ts`.

---

## 5. Retrieve User DNA

User DNA is **computed from transactions** on each request. There is no stored `dna_profiles` table. Transfers (`category === 'Transfer'`) are excluded from DNA traits.

### Full DNA profile (recommended)

```
GET /api/users/:userId/dna-profile?month=6&year=2026
```

```json
{
  "userId": "user_1",
  "traits": ["Coffee Lover", "Food Explorer"],
  "topCategories": [
    { "category": "Dining", "amount": 124.5, "share": 0.21 }
  ],
  "topMerchants": ["Starbucks Raffles Place", "Grab"],
  "avgDailySpend": 8.5,
  "travelHints": {
    "preferredCuisines": ["Coffee", "Local Dining"],
    "budgetStyle": "moderate",
    "typicalTripSpend": 612.0
  },
  "updatedAt": "2026-06-23T12:00:00.000Z"
}
```

| Field | Use in Payogotchi / Rewards |
|-------|----------------------------|
| `traits` | Spending DNA labels — e.g. "Coffee Lover", "Savvy Shopper" |
| `topCategories` | Where the user spends most (category + amount + share) |
| `topMerchants` | Favourite merchants by visit count |
| `avgDailySpend` | Average daily lifestyle spend for the month |
| `travelHints.budgetStyle` | `budget` \| `moderate` \| `premium` |
| `travelHints.typicalTripSpend` | Rough trip budget estimate |

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_BASE_URL } from '../core/api.config';
import { DnaProfile } from '../../../shared/api-contract';

const params = new HttpParams().set('month', '6').set('year', '2026');
this.http.get<DnaProfile>(`${API_BASE_URL}/users/${userId}/dna-profile`, { params })
  .subscribe((dna) => {
    const traits = dna.traits;
    const avgSpend = dna.avgDailySpend;
  });
```

### Lighter options

| What you need | Call | Returns |
|---------------|------|---------|
| Trait pills only | `transactionsService.getDashboard(userId, { month, year })` | `dnaTraits`, `recentTransactions`, `monthlySummary` |
| Traits + insight cards | `transactionsService.getInsights(userId, month, year)` | `traits`, `smartInsights`, `topSpots`, category donuts |

> **Typing note:** Import `DashboardResponse` from `src/app/services/api-contract.ts` for `dnaTraits` and `rewards` — the local type in `transactions.service.ts` is a slimmer subset.

### Rewards points (often needed alongside DNA)

| Source | Field |
|--------|-------|
| `authService.currentUser` | `points` |
| `GET /api/users/:userId` | `points`, `tier` |
| `getDashboard()` | `rewards.currentPoints` |

```typescript
import { DashboardResponse } from '../../../shared/api-contract';

this.transactionsService.getDashboard(userId, { month: 6, year: 2026 })
  .subscribe((dashboard) => {
    const d = dashboard as DashboardResponse;
    const traits = d.dnaTraits;
    const points = d.rewards.currentPoints;
    const recent = d.recentTransactions;
  });
```

---

## 6. Quick cheat sheet

```typescript
const userId = this.authService.userId!;

// 1. All transactions for a month
this.transactionsService.getTransactions(userId, { month: 6, year: 2026 });

// 2. One transaction's id and amount
response.transactions[0].id;     // transaction number
response.transactions[0].amount;  // negative = spent

// 3. Full User DNA profile
this.http.get(`${API_BASE_URL}/users/${userId}/dna-profile`, {
  params: new HttpParams().set('month', '6').set('year', '2026'),
});

// 4. Trait pills + points + recent txns
this.transactionsService.getDashboard(userId, { month: 6, year: 2026 });
```

### Core backend functions (reference — do not call from Angular)

| Layer | File | Key functions |
|-------|------|---------------|
| DB read | `backend/db/firestore-store.js` | `getTransactions()`, `getUser()`, `getCards()` |
| Period filter | `backend/services/period.js` | `parsePeriod()`, `filterByMonth()`, `listAvailablePeriods()` |
| DNA engine | `backend/services/dna.js` | `buildDnaProfile()`, `buildDashboard()`, `buildInsights()`, `formatTransaction()` |
| Trait rules | `backend/services/insight-engine.js` | `deriveDnaTraits()`, `pickSmartInsights()` |
| Routes | `backend/routes/api.js` | Wires HTTP → DB → DNA |

---

## 7. What is NOT built yet (your team's scope)

| Item | Status |
|------|--------|
| `users/{userId}/rewards/` CRUD API | Reserved path — add routes with Core |
| `users/{userId}/payogotchi/` CRUD API | Reserved path — add routes with Core |
| Updating `points` after reward redemption | Not implemented — coordinate with Core |
| True month-to-date filter | Not implemented — ask Core if needed |
| Direct Firestore access from Ionic | **Not allowed** — use `/api` |

---

## 8. Local testing

1. From project root: `npm start` (backend `:3000`, app `:8100`). Do **not** use `ionic serve` alone.
2. Firebase credentials — see `TEAM-SETUP-GUIDE.md`.
3. Seed demo data: `cd backend && npm run db:seed`
4. Log in as Alex (`91234567`, PIN `123456`).
5. Test with curl:

```bash
curl "http://localhost:3000/api/users/user_1/transactions?month=6&year=2026"
curl "http://localhost:3000/api/users/user_1/dna-profile?month=6&year=2026"
```

Replace `user_1` with `authService.userId` from the account you logged in with.

### Checklist before you start coding

- [ ] Cloned repo and on latest branch (`TEAM-SETUP-GUIDE.md`)
- [ ] `backend/firebase/service-account.json` in place
- [ ] Ran `cd backend && npm run db:seed`
- [ ] App runs with `npm start` and login works
- [ ] Your page injects `AuthService` + `TransactionsService`
- [ ] You use `authService.userId` — never hardcode in production code
- [ ] You read `txn.id` and `txn.amount` from API responses

---

## 9. When data updates

```
User pays / scans receipt / QR pay / P2P transfer
  → new Firestore transaction (Core)
  → next API call returns updated transactions + DNA
```

No manual refresh job. Call the API again after a payment to see new data.

---


When asking for help, include: your git branch, terminal error, and a screenshot.
