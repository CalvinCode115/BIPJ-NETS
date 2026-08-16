# NETS Wallet — guide for Eron (Travel & User DNA)

This document explains **how User DNA, Spending DNA, and Smart Insights are derived** in the codebase today, and **how Eron’s Travel Concierge feature should build on them**.

It is aligned with the team slides (*BIPJ Business Idea Proposal — Team 3*):

- **Jun Jie (CEO)** — Home, Pay, cards, transactions, **DNA Analysis Engine** (backend rules)
- **Eron (CTO)** — **NETS Beyond: AI Travel Concierge** (“Beyond Transactions”)
- **Yunen (CFO)** — Payogotchi, rewards, budgeting personas
- **Calvin (CSO)** — Payogotchi gamification, merchant/network

---

## 1. What the slides say vs what the code does

### Slide promise (Business Idea)

> *“NETS Beyond uses your unique User DNA — spending patterns from home — to curate personalised lifestyle intelligence.”*

Pipeline on slide 17:

```
User Spending Data  →  DNA Analysis Engine  →  Personalised Experiences
```

### Slide 18 — Eron’s Travel Concierge pillars

| Pillar | Slide description | In code today |
|--------|-------------------|---------------|
| **DNA Discovery** | Match SG lifestyle habits to regional gems | ✅ Traits + `travelHints` from `buildDnaProfile()` |
| **FX Strike Price** | AI predicts currency dips, Smart Buy alerts | ❌ Not built yet — future Travel tab work |
| **Smart Budgeting** | Real-time spend vs trip duration | ⚠️ Partial — monthly spend totals exist; trip-specific budgeting not built |
| **Zero-Friction Booking** | Venues accepting regional QR/NETS | ❌ Not built yet — future integration |

### Important clarification

There is **no real AI/LLM** in the current DNA engine. “User DNA” and “Smart Insights” are **rule-based**: they read the user’s **NETS transaction history** and apply **thresholds and templates**. That matches the slide problem statement — we avoid **generic, repetitive AI** by grounding recommendations in **actual local spend**.

Hypothesis (slide 14) Eron’s feature depends on:

> *Personalizing features based on User DNA will increase user engagement.*  
> *Gen Z users are more likely to use NETS overseas if travel recommendations are trustworthy and actionable.*

Your Travel tab should consume **computed DNA** (trustworthy because it comes from real NETS spend), not invent a second DNA system.

---

## 2. Where the data comes from

All DNA and insights come from **Firestore transactions** — one document per spend, top-up, PayNow, salary credit, etc.

```
users/{userId}/transactions/{transactionId}
```

Typical spend row:

| Field | Example |
|-------|---------|
| `merchant` | Starbucks Raffles Place |
| `category` | Coffee |
| `amount` | `-6.50` (negative = money out) |
| `occurred_at` | ISO date/time |
| `card_id` | linked card used |

Demo data is seeded from `backend/seed-data.js` (Alex, Sarah, Cheng, Adam). Reseed:

```bash
cd backend
npm run db:seed        # merge
npm run db:seed:reset  # full reset (careful)
```
=> back end:::::::::     .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
**There is no `dna_profiles` table.** DNA is **recomputed on every API call** from transactions. When the user pays or scans a receipt, a new transaction is saved → next API call reflects updated DNA.

---

## 3. The derivation pipeline (overview)

```
Firestore: users/{id}/transactions
        │
        ▼
  Filter by month (optional ?month=&year=)
        │
        ▼
  Lifestyle expenses only
  (amount < 0, category ≠ Transfer)
        │
        ▼
  merchant-tags.js — tag each row
  (Starbucks → drink_coffee, Agoda → travel_hotel, …)
        │
        ├──────────────────────────────┐
        ▼                              ▼
  deriveDnaTraits()              pickSmartInsights()
  (Spending DNA labels)          (narrative insight cards)
  insight-engine.js              insight-engine.js
        │                              │
        └──────────┬───────────────────┘
                   ▼
            buildDnaProfile()     buildInsights()
            (Travel profile)      (full Insights page)
            dna.js                dna.js
                   │                    │
                   ▼                    ▼
     GET /users/:id/dna-profile   GET /users/:id/insights
     (Eron — Travel tab)          (Home + Insights UI)
```

---

## 4. Step-by-step: how Spending DNA (traits) is derived

**Code:** `backend/services/insight-engine.js` → `deriveDnaTraits()`

### Step A — Lifestyle filter

Only transactions where:

- `amount < 0` (spending out)
- `category !== 'Transfer'` (PayNow / top-ups excluded from lifestyle DNA)

Incoming salary and PayNow **received** are ignored for traits but still stored.

### Step B — Merchant tagging

**Code:** `backend/services/merchant-tags.js`

Each expense gets tags:

1. Match merchant name against `backend/data/pay-qr-merchants.json` tags  
2. Else match static list (Grab → `transport_ride`, Agoda → `travel_hotel`, …)  
3. Else fall back to category (Dining → `food_casual`, Travel → `travel_other`, …)

Tags are aggregated per month: **total dollars** and **visit count** per tag.

Examples: `drink_coffee`, `drink_bubble_tea`, `food_hawker`, `groceries`, `retail_fashion`, `travel_flight`, `travel_hotel`, `travel_activity`, `transport_ride`, `health_wellness`

### Step C — Score candidate traits

Each trait gets a **score** from the month’s spend. Traits with score > 0 are ranked; **top 4** are returned. If none match → **`Balanced Spender`**.

| Trait | Rule (must exceed threshold) |
|-------|------------------------------|
| **Travel Explorer** | flight + hotel tag spend ≥ **$80** |
| **Wellness Focused** | pharmacy tag + Health category ≥ **$35** |
| **Home Chef** | Groceries ≥ **22%** of lifestyle spend |
| **Savvy Shopper** | fashion tag ≥ **$40** OR Retail ≥ **28%** of spend |
| **Active Lifestyle** | sports retail tag ≥ **$30** |
| **Food Explorer** | Dining ≥ **22%** of lifestyle spend |
| **Coffee Lover** | coffee ≥ **$18** OR ≥ **3** coffee visits |
| **Bubble Tea Fan** | bubble tea ≥ **$12** OR ≥ **2** visits |
| **Kopitiam Regular** | milo + hawker tags ≥ **$35** |
| **On-the-go Commuter** | Transport ≥ **18%** of lifestyle spend |
| **Budget Conscious** | total lifestyle spend ≤ **$300** |

These labels appear as:

- **DNA trait pills** on Home and Insights pages  
- Input to **Smart Insights** (4th card is often the top trait)  
- **`traits`** array in `dna-profile` for Travel

---

## 5. Step-by-step: Smart Insights

**Code:** `backend/services/insight-engine.js` → `pickSmartInsights()`

Smart Insights are **short narrative cards** (title, message, icon, colours) — e.g. *“Trip Planner — Travel bookings total $765…”* on Home.

### How templates work

Each template in `INSIGHT_TEMPLATES` has:

- **`score(ctx)`** — returns `0` if the pattern does not apply, else a positive number  
- **`build(ctx)`** — returns `{ title, message, icon, color, bg }` with **real dollar amounts** from the user’s month

| Template | Theme | Activates when (summary) |
|----------|-------|---------------------------|
| bubble_tea | drinks | bubble tea spend ≥ $6 |
| coffee | drinks | coffee ≥ $8 and beats bubble tea |
| local_drinks | drinks | milo + soy + juice ≥ $6 |
| dining | food | Dining category ≥ $15 |
| groceries | groceries | Groceries ≥ $25 |
| fashion | retail | fashion tag ≥ $20 |
| pharmacy | retail | pharmacy tag ≥ $12 |
| **travel** | travel | flight + hotel + activity ≥ **$50** |
| wellness | wellness | Health + clinic ≥ $20 |
| transport | transport | Transport ≥ $12 |
| sports | retail | sports retail ≥ $25 |

### Picking logic

1. Score every template for the selected month  
2. Drop score 0; sort highest first  
3. Take up to **3 cards**, **one per theme** (drinks, food, retail, travel, …) — avoids repetition  
4. Append a **4th card**: user’s top DNA trait (trophy icon), unless already used  
5. Return at most **4 cards**

### Where they appear in the app

| Place | How |
|-------|-----|
| **Home teaser** | First card only — `smartInsights[0]` via dashboard/insights load |
| **Insights page** | All cards — `/tabs/home/home-ai-insights` |
| **Eron’s Travel pitch** | If user has travel spend, **“Trip Planner”** card often surfaces — same engine |

Message text is **templated**, not LLM-generated — e.g. *“You spent $24.50 on coffee in Jun 2026.”*

---

## 6. User DNA Profile (what Eron consumes for Travel)

**Code:** `backend/services/dna.js` → `buildDnaProfile()`

This is the main API shape for **NETS Beyond / Travel Concierge**. It reuses the same traits engine plus travel-specific hints.

### Endpoint

```
GET /users/:userId/dna-profile?month=6&year=2026
```

### Response fields

```json
{
  "userId": "user_1",
  "traits": ["Travel Explorer", "Coffee Lover"],
  "topCategories": [
    { "category": "Dining", "amount": 124.5, "share": 0.21 }
  ],
  "topMerchants": ["Starbucks Raffles Place", "Grab"],
  "avgDailySpend": 8.5,
  "travelHints": {
    "preferredCuisines": ["Coffee", "Local Dining", "Regional Travel"],
    "budgetStyle": "moderate",
    "typicalTripSpend": 612.0
  },
  "updatedAt": "2026-06-23T12:00:00.000Z"
}
```

### How each field is derived

| Field | Derivation |
|-------|------------|
| **traits** | Same as Section 4 — `deriveDnaTraits()` |
| **topCategories** | Sum spend per category; sort by amount; include **share** of total lifestyle spend |
| **topMerchants** | Top **5 merchants by visit count** (not dollar amount) |
| **avgDailySpend** | Total lifestyle spend for month ÷ **30** |
| **travelHints.preferredCuisines** | Signals from categories/merchants: Japanese, Coffee, Local Dining, Regional Travel |
| **travelHints.budgetStyle** | `budget` if spend ≤ $400; `moderate` if ≤ $800; else `premium` |
| **travelHints.typicalTripSpend** | Monthly lifestyle spend × **1.2** (rough trip budget estimate) |

**`updatedAt`** is when the profile was **computed**, not when a DNA record was saved — there is no persisted DNA document.

### Mapping to slide 18 (DNA Discovery)

| Slide concept | Use in Travel UI |
|---------------|------------------|
| Match SG lifestyle to regional gems | Use `traits` + `travelHints.preferredCuisines` to filter/prioritise destinations and activities |
| Trustworthy, not generic AI | Copy explains *“Because you spend on coffee and regional travel locally…”* — cite real `topCategories` / traits |
| Smart Budgeting (future) | Start with `budgetStyle` + `typicalTripSpend` + live trip spend from transactions |

---

## 7. Full Insights API (related — Jun Jie’s UI)

Eron does not own this page, but the **same engine** powers it.

```
GET /users/:userId/insights?month=6&year=2026
```

**Code:** `backend/services/dna.js` → `buildInsights()`

Also returns:

- `summaryStats` — total spent, transaction count, avg/day  
- `deepDives` — food / retail / travel sub-charts (`insight-deep-dives.js`)  
- `topSpots` — favourite merchants by **dollar spend** (`top-spots.js`)  
- `transportAnalysis` — Grab/transit patterns  
- `smartInsights` + `traits` — as above  
- `availablePeriods` — months with data (month picker)

---

## 8. Code map (where everything lives)

### Backend — DNA & insights engine (Jun Jie maintains)

| File | Responsibility |
|------|----------------|
| `backend/services/insight-engine.js` | **Traits** + **Smart Insight** templates |
| `backend/services/merchant-tags.js` | Merchant → lifestyle tags |
| `backend/services/dna.js` | `buildDnaProfile()`, `buildInsights()`, dashboard |
| `backend/services/insight-deep-dives.js` | Food / retail / travel chart buckets |
| `backend/services/top-spots.js` | Top merchants by spend |
| `backend/routes/api.js` | Routes: `/insights`, `/dna-profile`, `/dashboard` |
| `backend/seed-data.js` | Demo users + transaction history |

### Frontend — Insights UI (Jun Jie)

| File | Responsibility |
|------|----------------|
| `src/app/home-ai-insights/` | Full Insights page |
| `src/app/home/home.page.ts` | Home teaser (`loadOverallInsight`) |
| `src/app/services/transactions.service.ts` | `getInsights()` HTTP client |

### Frontend — Travel (Eron — your tab)

| File | Responsibility |
|------|----------------|
| `src/app/pages/travel/` | Travel tab UI (**mostly empty template today**) |
| `src/app/services/api-contract.ts` | TypeScript types — extend `DnaProfile` if needed |

---

## 9. What Eron should build (Travel tab)

Current `travel.page.html` is a blank shell. Recommended approach:

1. **Call `GET /users/:userId/dna-profile`** after login (same month as Home or let user pick month).  
2. **Display DNA Discovery** using `traits`, `topCategories`, `travelHints`.  
3. **Personalise copy** — e.g. *“As a Travel Explorer who spends on Coffee locally, consider…”*  
4. **Layer slide 18 features** on top when ready:
   - FX Strike — new service + UI (not in repo yet)  
   - Smart Budgeting — trip budget vs `typicalTripSpend`  
   - Booking — external APIs / merchant QR catalog (`backend/data/pay-qr-merchants.json` has travel merchants)

### Optional richer data

```
GET /users/:userId/insights?month=&year=
```

Use if Travel needs `deepDives` (flights vs hotels split) or `topSpots`.

### Raw transactions (custom logic only if needed)

```
GET /users/:userId/transactions?category=Travel
```

---

## 10. How to test locally

1. From project root: `npm start` (backend `:3000` + app `:8100`).  
2. Place `backend/firebase/service-account.json` (see `START-FIREBASE.md`).  
3. Log in as **Alex** — `91234567`, PIN `123456` (richest travel + lifestyle history).  
4. Hit APIs directly:

```
http://localhost:3000/api/users/user_1/dna-profile?month=6&year=2026
http://localhost:3000/api/users/user_1/insights?month=6&year=2026
```

5. Firestore Console → `users/user_1/transactions` to inspect raw rows.  
6. Home tab → yellow insight card + trait pills (Jun Jie’s UI) — same data you will use.

---

## 11. Wallet-wide scope & card filters

- **All card types** (prepaid, cashcard, debit/credit) feed DNA and insights.  
- Home **card carousel filter** only changes dashboard categories and recent tx — **not** traits or smart insights (wallet-wide analysis).

---

## 12. What we do NOT extract today

| Not available | Notes |
|---------------|-------|
| GPS / location | — |
| Real airline/hotel booking APIs | Slide goal for Eron |
| LLM-generated insight text | All rule-based templates |
| Persisted DNA snapshot | Always live from transactions |
| FX Strike / currency prediction | Slide goal — not implemented |
| Cross-user comparisons | — |

---

## 13. When data updates

```
User pays / scans receipt / QR pay / P2P
        → new Firestore transaction
        → next GET /dna-profile or /insights recomputes everything
```

No background job. No manual “refresh DNA” step.

---

## 14. Coordination

| Topic | Owner |
|-------|-------|
| Change trait rules or insight templates | Jun Jie — `insight-engine.js` |
| Change merchant → tag mapping | Jun Jie — `merchant-tags.js`, QR catalog |
| Travel UI, FX, budgeting, booking | **Eron** — `travel/*` |
| Home, Pay, cards | Jun Jie |
| Payogotchi | Calvin / Yunen |

Before changing `deriveDnaTraits()` or `travelHints` logic, sync with Jun Jie — Travel and Home/Insights share the same engine.

---

## 15. Quick API reference

| Method | Route | Primary consumer |
|--------|-------|------------------|
| GET | `/users/:userId/dna-profile?month=&year=` | **Eron — Travel** |
| GET | `/users/:userId/insights?month=&year=` | Home + Insights page |
| GET | `/users/:userId/dashboard` | Home dashboard teaser |
| GET | `/users/:userId/transactions` | Optional raw history |

Base URL (local): `http://localhost:3000/api`

---

## 16. Team setup

Firebase, Git, and service account setup: see **`START-FIREBASE.md`**.

Demo logins (PIN `123456`): Alex `91234567`, Sarah `87654321`, Cheng `80680505`, Adam `84688331`.
