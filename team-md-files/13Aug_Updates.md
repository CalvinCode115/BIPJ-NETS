# THIS IS A FULL UPDATE LIST CONTAINING THE CHANGES MADE BY ERON, YUNEN AND JUNJIE. PLEASE READ THROUGH ALL IN DETAIL!



# ==================================================================================================================================
# =============ERONS CHANGES SUMMARY ===============================================================================================
# ==================================================================================================================================

# Travel Page Multi-Currency & Itinerary Enhancements — Changelog

> **Date:** 2026-08-12  
> **Author:** Travel Module Developer  
> **Scope:** Frontend (`travel.page.ts`, `fx-tracker.page.ts`, `home.page.ts`) + Backend (`api.js`)  
> **Breaking Change:** Card `balance` field deprecated in favor of `multi_currency` map

---

## 1. Multi-Currency Payment System (Overseas Travel)

### Problem
When paying in foreign currencies (MYR, KRW, etc.), the system was reading from a stale `CardLinkedExchangeService` instead of the Firestore `multi_currency` wallet that the FX tracker writes to.

### Files Changed

#### `src/app/pages/travel/travel.page.ts`
- **Replaced** `loadMultiCurrencyBalances()` to use `CardsService.getCardWallet()` instead of `CardLinkedExchangeService.getAllCurrencies()`
- **Added** `getCurrencyFlag()` helper for `CardCurrencyBalance` interface compliance
- **Updated** `confirmPayment()` to:
  - Convert foreign currency amounts to SGD equivalent using `fxInsight.currentRate`
  - Check balance in the **payment currency** (not SGD)
  - Dispatch `nets:travelPaymentCompleted` event with full transaction details for home page integration

```typescript
// Before: Read from wrong service
this.cardExchange.getAllCurrencies(cardId, sgdBalance)

// After: Read from same Firestore endpoint as FX tracker
this.cardsService.getCardWallet(userId, this.activeCard.id)
```

#### `src/app/services/cards.service.ts`
- **Updated** `getCardFundsAmount()` to read from `multi_currency.SGD` first, falling back to legacy `balance`:

```typescript
export function getCardFundsAmount(card: WalletCard | null | undefined): number {
  if (!card) return 0;
  return (card as any).multi_currency?.SGD ?? card.balance ?? 0;
}
```

---

## 2. Backend Payment Deduction Fix

### Problem
The `/deduct` endpoint was reusing `exchangeCurrency()` logic, which applied a 0.5% fee and only deducted the fee amount instead of the full payment amount.

**Example bug:** Paying 80 MYR only deducted 0.40 MYR (the fee) instead of 80 MYR.

### File Changed

#### `backend/routes/api.js`
- **Added** `deductFromMultiCurrency()` helper function for direct multi-currency deduction (no fees)
- **Replaced** `/users/:userId/cards/:cardId/deduct` route to:
  - Detect multi-currency vs legacy cards
  - Deduct **full amount** from `multi_currency[currency]` for multi-currency cards
  - Fall back to `updateCardBalance()` for legacy SGD-only cards
  - Support both local payments (friends) and overseas payments (travel)

```javascript
// Before: Reused exchange logic — only deducted fee
result = await db.exchangeCurrency(cardId, currency, currency, amount, 1);

// After: Direct deduction — deducts full amount
result = await deductFromMultiCurrency(cardId, currency, amount);
```

---

## 3. Home Page Integration (Friend's Code)

### Problem
Travel payments were not appearing in recent transactions or rewards on the home page.

### Files Changed

#### `src/app/pages/home/home/home.page.ts`
- **Added** `PetBridgeService` injection for rewards calculation
- **Updated** `setupExchangeListener()` to handle `nets:travelPaymentCompleted`:
  - Reloads multi-currency balances
  - Awards **points based on SGD equivalent** (not inflated foreign currency)
  - Injects transaction into `recentTransactions` with proper formatting
  - Persists to `sessionStorage` for cross-page persistence

```typescript
window.addEventListener('nets:travelPaymentCompleted', (event: any) => {
  const detail = event.detail;
  // 1. Reload balances
  this.loadMultiCurrencyBalances();
  this.loadCardsForUser(this.auth.userId ?? 'user_1');

  // 2. Award rewards using SGD equivalent
  const pet = this.petBridge.record(detail.sgdEquivalent, detail.category, detail.venue);

  // 3. Add to recent transactions
  this.recentTransactions = [newTxn, ...this.recentTransactions].slice(0, 5);
});
```

#### `src/app/services/home-wallet.service.ts`
- **Fixed** `persistWalletSgdSnapshot()` to use `getCardFundsAmount()` instead of `selectedCard.balance`
- **Fixed** `loadCurrencyBalances()` to write actual SGD from `multi_currency` response to localStorage

```typescript
// Before: Writes stale balance
localStorage.setItem(key, String(selectedCard.balance));

// After: Writes real SGD from multi_currency
localStorage.setItem(key, String(getCardFundsAmount(selectedCard)));
```

---

## 4. Itinerary Generation Lock & Variation

### Problem
1. Users could spam-click "Generate My Itinerary" causing duplicate API calls
2. "Regenerate Day" produced the exact same itinerary every time

### File Changed

#### `src/app/pages/travel/travel.page.ts`
- **Added** `generationCount` seed for deterministic variation
- **Updated** `generateDayPlans()`:
  - Early return if `isGeneratingPlans` is already true (prevents double-clicks)
  - Passes `generationCount` to `buildItinerary()`
- **Replaced** `regenerateDay()` to only regenerate the specific day (not entire trip)

```typescript
async regenerateDay(day: DayPlan) {
  const dayIndex = this.dayPlans.findIndex(d => d.day === day.day);
  this.generationCount++;
  const freshPlans = await this.smartPlanner.buildItinerary(
    venues, nearbySearcher, numTripDays, recommendations, this.generationCount
  );
  this.dayPlans[dayIndex] = freshPlans[dayIndex];
}
```

#### `src/app/services/smart-planner.service.ts`
- **Added** `variationSeed` parameter to `buildItinerary()`
- **Added** `shuffleWithSeed()` helper for deterministic venue reordering
- **Fixed** duplicate venue bug by adding `usedSignatures` Set that deduplicates across both user-added venues AND DNA recommendations by normalized name + coordinates

```typescript
const seen = new Set<string>();
const addIfNew = (venue: PlannedVenue) => {
  const sig = `${venue.name.toLowerCase().trim()}|${venue.lat.toFixed(3)}|${venue.lng.toFixed(3)}`;
  if (seen.has(sig)) return;
  seen.add(sig);
  // ... add to day
};
```

---

## 5. Time-Aware Itinerary ("Right Now" Highlighting)

### Feature
Timeline now shows live status: **LIVE** (current), **in 45m** (up next), or faded (past).

### Files Changed

#### `src/app/pages/travel/travel.page.ts`
- **Added** `getVenueTimeStatus()`, `isNextUp()`, `getMinutesUntil()`, `formatMinutes()` helpers

#### `src/app/pages/travel/travel.page.html`
- **Added** status classes (`past`, `current`, `upcoming`) to timeline items
- **Added** live badge, next badge with formatted time
- **Replaced** number with location icon for current venue

#### `src/app/pages/travel/travel.page.scss`
- **Added** `.past` (50% opacity, grey), `.current` (red pulse, border glow), `.upcoming` (blue glow)
- **Added** `@keyframes pulse-ring` and `@keyframes pulse-badge` animations

---

## 6. Contextual Nearby Suggestions ("While You're Here")

### Feature
When expanding a venue card, shows up to 3 nearby spots within 200m — DNA picks flagged with sparkles icon.

### Files Changed

#### `src/app/pages/travel/travel.page.ts`
- **Added** `nearbyCache` Map for performance
- **Added** `precomputeNearbySuggestions()` — called after itinerary generation
- **Added** `computeNearbyForVenue()` with deduplication by normalized name
- **Added** `isPayableVenue()` and `openPaymentModalFromVenue()` for quick pay

```typescript
getNearbySuggestions(venue: PlannedVenue): Array<{ name, distance, type, isDna }> {
  const key = `${venue.name}|${venue.lat.toFixed(5)}|${venue.lng.toFixed(5)}`;
  return this.nearbyCache.get(key) || [];
}
```

#### `src/app/pages/travel/travel.page.html`
- **Added** `.nearby-card` section inside `.venue-details`
- **Added** `.quick-pay-strip` with "Pay here" button for restaurants/cafes in trip mode

#### `src/app/pages/travel/travel.page.scss`
- **Added** `.nearby-card`, `.nearby-header`, `.nearby-list`, `.nearby-item`, `.dna-badge` styles
- **Added** `.quick-pay-btn` red button styling

---

## 7. FX Tracker Same-Currency Guard

### Problem
User could accidentally exchange KRW → KRW (same currency), causing balance reduction via fee.

### File Changed

#### `src/app/pages/fx-tracker/fx-tracker.page.ts`
- **Added** same-currency guard in `doExchange()`:

```typescript
if (this.baseCurrency === this.targetCurrency) {
  this.exchangeResult = {
    success: false,
    message: `Cannot exchange ${this.baseCurrency} to ${this.targetCurrency}.`,
  };
  return;
}
```

---

## Summary Table

| Feature | Files | Lines Changed |
|---------|-------|---------------|
| Multi-currency payment | `travel.page.ts`, `cards.service.ts` | ~40 |
| Backend deduction fix | `api.js` | ~60 |
| Home page integration | `home.page.ts`, `home-wallet.service.ts` | ~80 |
| Itinerary lock + variation | `travel.page.ts`, `smart-planner.service.ts` | ~50 |
| Time-aware timeline | `travel.page.ts`, `.html`, `.scss` | ~120 |
| Nearby suggestions | `travel.page.ts`, `.html`, `.scss` | ~100 |
| FX same-currency guard | `fx-tracker.page.ts` | ~10 |

---

## Testing Checklist

- [ ] Exchange SGD → MYR, then pay 80 MYR — balance deducts exactly 80
- [ ] Pay in KRW — SGD equivalent shows correctly in home transactions
- [ ] Generate itinerary — button disables during load, shows "Generating..."
- [ ] Regenerate day — produces different venue order
- [ ] No duplicate venues in same day or across days
- [ ] Time-aware highlighting shows correct status based on current time
- [ ] Nearby suggestions show unique venues within 200m
- [ ] Quick pay button appears only for restaurants/cafes in trip mode
- [ ] Home page receives travel payment in recent transactions with correct SGD amount
- [ ] Rewards points calculated from SGD equivalent (not foreign amount)
# ==================================================================================================================================
# ==================================================================================================================================
# ==================================================================================================================================



# ==================================================================================================================================
# =========== YUNENS CHANGES SUMMARY ===============================================================================================
# ==================================================================================================================================
# Rewards System — Changelog (9–11 August)

Organized by feature area rather than strict chronological order, for
readability. Everything below was built, fixed, or refined within this
window.

---

## 1. Core Bug Fixes & Infrastructure

- Fixed `voucherCatalogRef is not a function` crash on the Rewards
  Marketplace — a Firestore path helper file wasn't updated with the
  Marketplace's new collection refs.
- Fixed a real race condition: applying a voucher discount was committing       
  the voucher as "used" **before** checking if the card had enough
  balance — if the payment then failed for insufficient funds, the
  voucher was already burned for nothing. Split into a read-only preview
  step and a separate commit step that only runs after the payment
  actually succeeds. 
- Fixed a matching-logic bug: National Day's voucher (and later, two new
  category-based vouchers) used `merchantIds: ['any']`, which was
  incorrectly matching **every** category, not just the intended one — the
  category restriction was being silently bypassed by the wildcard
  merchant match.
- Fixed several pages silently no longer refreshing after their first
  visit each session — they used Angular's `ngOnInit()` (fires once per
  component instance) instead of Ionic's `ionViewWillEnter()` (fires every
  time the page becomes active), which broke once Ionic started reusing
  page instances instead of recreating them.
- Fixed a bug where `recordQuestEvent` silently did nothing for any quest
  whose progress entry hadn't been created yet (which only happens after
  visiting that quest's page) — a transaction happening before ever
  opening Daily/Weekly Quests meant the event had nothing to attach to.
  Now self-heals missing entries on the spot.

## 2. Points Economy Rebalance

- Changed the core conversion rate from 10 points per $1 spent to **1
  point per $1 spent**, so that XP stay easy to earn while NETS Points 
  become harder.
- Rescaled every quest, challenge, and voucher point value to match
  (÷10 across the board, minimum 1).
- Later **doubled every voucher's points cost** as a second economy pass.
- Added a **daily earning cap**: max 300 points per day (across spending,
  quests, weekly quests, and challenges combined) and max 20
  point-earning transactions per day. Applied consistently across all
  four reward sources, each properly wrapped in atomic Firestore
  transactions to prevent the cap itself being raced past.
- Added a **maximum balance cap** of 5,000 points. System-awarded points
  (transactions, quests, challenges, check-in) are capped and any excess
  silently discarded; Send Points to Friends instead **warns the sender**
  and lets them choose to send a reduced amount instead of silently
  losing value.
- Built the **About NETS Points** page explaining all of this in plain
  language, linked via an info icon on the NETS Points page.
- Added a toast on the NETS Points page whenever today's cap has been
  reached, so users understand why their next reward might come in
  smaller than expected.

## 3. New Features Built

- **My Badges** — a new page showing every badge earnable across the
  system (locked/earned states), backed by a real persistent collection.
  Unified the previously-cosmetic "title" and "badge" reward styles into
  one system, since they were functionally identical.
- **Real vouchers from Partner Challenges** — 5 of the 8 challenges now
  grant an actual usable voucher on claim (reusing the Marketplace
  catalog), not just a text label with no function.

## 4. Daily & Weekly Quest Rebalancing

- Replaced **Daily Check-In Streak Bonus** with **Mix It Up** (spend in 2
  categories today) — the original design was mathematically impossible
  to complete on some days it was randomly assigned.
- Replaced **Social Butterfly** and **Bill Splitting Pro** (both depended
  on a bill-splitting feature that won't be built) with **Retail Week**
  and **Grocery Grab**.
- Reduced **Commuter Champion**'s target from 10 to 3 transport fares,
  after confirming Transport is a very sparsely populated merchant
  category.
- Adjusted several points values (Triple Threat, Neighbourhood Explorer,
  Commuter Champion) based on review.
- Added **quest "families"** so the daily/weekly rotation never assigns
  two near-duplicate quests (e.g. two spend-amount thresholds) on the same
  day, and the rotation now avoids repeating the immediately preceding
  day's/week's exact picks.

## 5. Partner Challenge Fixes

- Fixed a mislabeled progress caption — Bubble Tea Buddy and Fashion
  Refresh were both hardcoded to say "X/Y cafes visited" (copied from
  Coffee Connoisseur Route), even though neither is about cafes.
- Fixed a real bug: **event-type challenges never had expiry detection at
  all** — only fixed-duration ones did. This is why National Day kept
  showing as active regardless of its date.
- Extended National Day's window from 1–9 August to 1–15 August, and its
  matching Marketplace voucher to the same range.
- Added a real description to every challenge explaining exactly what to
  do, which merchants count, and how long you have.

## 6. My Vouchers & Marketplace UX

- Added search, a Purchased/Reward source filter, and an automatic
  "Expiring Soon" section (sorted soonest-first) to My Vouchers.
- Added a 6th quick-nav tile (My Badges) and gave all 6 tiles distinct
  accent colors plus notification badges showing unclaimed
  quests/challenges and vouchers expiring soon.
- Removed a redundant "Open My Vouchers and tap this voucher" line from
  every voucher's usage instructions.
- Fixed comments on Send Points transfers never actually being shown to
  the receiver — the backend was storing them correctly all along; only
  the display was missing.

## 7. Marketplace Catalog Changes

- Added structured `minSpend` and `discountType`/`discountValue`/
  `discountCap` fields to every voucher (previously only described in
  free-text terms, not actually machine-checkable).
- Adjusted Watsons' and Cotton On's minimum spend down ($30→$15,
  $50→$25).
- Updated validity periods per merchant (LiHO/Boost Juice/Starbucks → 30
  days, Watsons/Decathlon/Cotton On → 45 days, Klook → 7 days).
- Added 2 new **category-based** vouchers (matching any merchant within
  the category, not one specific brand, same pattern as National Day):
  a $10 Groceries voucher and a 10%-off-up-to-$15 Travel voucher.
- Added a "Valid for X days" line to every voucher's terms, matching its
  actual validity.

# Points Caps — What You Need to Know =============================================================

A quick explainer for the team on two limits I added to the NETS Points
system, in case your feature touches points anywhere.

## TL;DR

- You can't earn more than **300 points per day**, or from more than
  **20 point-earning transactions per day** — this covers spending,
  Daily/Weekly Quests, and Partner Challenges.
- No single account can ever **hold more than 5,000 points** at once.
- **Sending points to a friend is exempt from the daily cap** (but not the
  5,000 max) — this was a deliberate decision, not an oversight.

## Why these exist

Without a limit, points could be farmed — repeatedly scanning the same
receipt, splitting one purchase into fifty tiny transactions, or claiming
a burst of quests all at once. The daily cap stops that without affecting
anyone playing normally; the 5,000 max just prevents unbounded
accumulation over a long period.

## If your feature awards or touches NETS Points

**Talk to me before wiring anything new into the points balance.** Right
now, exactly four things are allowed to credit points, and all four go
through the same shared cap check:

- `services/transaction-rewards.js` — spending
- `services/quests.js` — Daily Quest, Weekly Quest, and Challenge claims
- `services/daily-checkin.js` — the check-in reward

If you're building something that should also award points (say,
Payogotchi has a milestone that grants a points bonus), it needs to call
`getTodaysPointsBudget()` from `services/points-budget.js` and
`capBalanceAward()` from `services/points-balance-cap.js` the same way
these four do — otherwise it'll silently bypass both caps, which would
undermine the whole point of having them.

## The Send Points to Friends decision

Points received via a friend's transfer are **not** subject to the daily
earning cap — only the 5,000 max balance applies (and even then, the
sender gets warned and can choose to send less, rather than points
silently vanishing). This was a deliberate call: a transfer isn't new
points entering the system, it's already-earned value moving between two
accounts, so it felt wrong to block a friend's gift because of *your*
quest activity that day.

**Known tradeoff, left as-is on purpose**: since transfers aren't capped
daily, a coordinated group could theoretically route around the 300-point
cap by having several people each earn up to their own limit, then all
send to one account. We decided this isn't worth the added complexity to
close right now — flagging it here so nobody's surprised if it comes up.

## Where the logic actually lives

| File | What it does |
|---|---|
| `services/points-budget.js` | Computes today's remaining points/transaction headroom |
| `services/points-balance-cap.js` | Computes how much can be added before hitting 5,000 |
| `services/transaction-rewards.js` | Spending points — both caps applied |
| `services/quests.js` | Quest/Challenge claim points — both caps applied |
| `services/daily-checkin.js` | Check-in points — both caps applied |
| `services/points-transfer.js` | Send Points — only the 5,000 cap applied |


# Rewards System — Complete Reference

Everything currently in the catalog — quests, challenges, and Marketplace
vouchers. Points reflect the current economy (1 NETS Point = $1 spent).

⚠️ **All quest/challenge point awards are subject to two caps**: a maximum
of 300 points earnable per day (across spending, quests, and challenges
combined) and a maximum of 20 point-earning transactions per day. A user's
total points balance is also capped at 5,000 — a reward can come in
smaller than listed here if either limit is close to being hit.

⚠️ **XP, Pet Happiness, and cosmetic rewards are not yet functional** —
they require a hook into the Payogotchi teammate's system. Only the NETS
Points portion of each reward is actually applied today. **Badge-style
rewards are** functional — completing a quest/challenge with a badge
reward now creates a real, persistent badge on the My Badges page.

---

## Daily Quests
15 templates — 4 to 5 randomly assigned each day, resetting at 12:00am.
Templates are grouped into "families" so the daily rotation never assigns
two near-duplicate quests (e.g. two spend-amount thresholds) on the same
day, and the rotation avoids repeating yesterday's exact picks where
possible.

| Name | Points | Action to complete | Mechanism | Other rewards |
|---|---|---|---|---|
| Coffee Run | 1 | Buy from a Coffee-category merchant | `transaction_count` (target 1, category Coffee) | [Buff] Energized |
| Big Spender | 8 | Spend over $50 in one day | `spend_amount` (target 50) | Rare Cosmetic Chance |
| Explorer | 4 | Visit a merchant you've never paid before | `visit_new_merchant` (target 1) | +5 Pet Happiness |
| First Transaction of the Day | 2 | Make any transaction today | `transaction_count` (target 1) | +100 XP |
| Penny Saver | 1 | Make one transaction under $5 | `transaction_under_amount` (target 1, maxAmount 5) | — |
| Mix It Up | 2 | Spend in 2 different categories today | `merchant_category_count` (target 2) | — |
| Lunch Run | 2 | Buy F&B between 11am–2pm | `transaction_count` + `hourRange` (hours 11–14) | +50 XP |
| Transport Tap | 1 | Pay for a ride or transit fare | `transaction_count` (category Transport) | — |
| Triple Threat | 4 | Make 3 transactions today | `transaction_count` (target 3) | +75 XP |
| Retail Therapy | 2 | Make a Retail-category purchase | `transaction_count` (category Retail) | — |
| Mid-Range Spender | 3 | Spend over $20 today | `spend_amount` (target 20) | +10 Pet Happiness |
| Neighbourhood Explorer | 7 | Visit 2 new merchants today | `visit_new_merchant` (target 2) | Rare Cosmetic Chance |
| Early Bird | 2 | Make a purchase before 9am | `transaction_count` + `hourRange` (hours 0–9) | [Buff] Energized |
| Night Owl | 2 | Make a purchase after 9pm | `transaction_count` + `hourRange` (hours 21–24) | — |
| Beverage Break | 1 | Buy a Drinks/Coffee-category drink | `transaction_count` (category Drinks/Coffee) | +30 XP |

---

## Weekly Quests
10 templates — 3 assigned each week, resetting Monday 12:00am.

| Name | Points | Action to complete | Mechanism | Other rewards |
|---|---|---|---|---|
| Diverse Spender | 15 | Spend in 5 different categories this week | `merchant_category_count` (target 5; Coffee/Drinks count as Dining) | +500 XP, 'Variety Seeker' Badge |
| Streak Keeper | 20 | Transact every day for 7 straight days | `streak_day` (target 7) | Legendary Cosmetic Unlock |
| Retail Week | 12 | Make 3 retail purchases this week | `transaction_count` (target 3, category Retail) | +300 XP |
| Big Week | 10 | Spend $100 total this week | `spend_amount` (target 100) | +300 XP |
| Frequent Flyer | 15 | Make 15 transactions this week | `transaction_count` (target 15) | +400 XP |
| Foodie Tour | 12 | Make 5 F&B purchases this week | `transaction_count` (target 5, category Dining/Coffee/Drinks) | Foodie Pet Theme |
| Explorer+ | 18 | Visit 5 new merchants this week | `visit_new_merchant` (target 5) | Rare Cosmetic Unlock |
| Commuter Champion | 8 | Pay for 3 transport fares this week | `transaction_count` (target 3, category Transport) | +350 XP |
| Big Spender+ | 22 | Spend over $200 this week | `spend_amount` (target 200) | Legendary Cosmetic Unlock |
| Grocery Grab | 12 | Make 3 grocery purchases this week | `transaction_count` (target 3, category Groceries) | +300 XP |

---

## Partner Challenges
8 total, spread across all 4 duration types. Requires an explicit tap on
**"Start Challenge"** before any spending counts toward it.

| Name | Points | Action to complete | Mechanism | Other rewards | Real voucher granted | Duration |
|---|---|---|---|---|---|---|
| Bubble Tea Buddy | 8 | Visit 3 of: LiHO Tea, Gong Cha, Mr Bean, Boost Juice | `visit_count_at_merchants` (target 3) | Bubble Tea Lover Badge | LiHO Tea $1 Voucher | Permanent |
| Grocery Run Challenge | 6 | Spend $30 at NTUC FairPrice / Cold Storage / FairPrice Finest | `spend_amount_at_merchant` (target 30) | Grocery Saver Badge | — | Permanent |
| Fashion Refresh | 15 | Visit 2 of: Uniqlo, H&M, Cotton On, Muji | `visit_count_at_merchants` (target 2) | Trendsetter Badge | Cotton On $15 Voucher | Monthly (resets 1st) |
| Coffee Connoisseur Route | 40 | Visit 5 indie cafes (Ya Kun, Killiney, Toast Box, Dough Culture, Marina Bay Hawker) | `visit_count_at_merchants` (target 5) | 'Coffee Master' Badge, Coffee Bean Pet Theme Badge | Starbucks $5 Voucher | Monthly |
| Weekend Feast | 12 | Spend $30 at Din Tai Fung / Ichiban Sushi / Pizza Hut, within 5 days of starting | `spend_amount_at_merchant` (target 30) | Foodie Weekend Badge, [Buff] Well Fed (24h) | — | Fixed, 5 days |
| Wellness Week | 8 | Spend $20 at Guardian Pharmacy / Watsons, within 14 days of starting | `spend_amount_at_merchant` (target 20) | Wellness Warrior Badge | Watsons $10 Voucher | Fixed, 14 days |
| National Day Spending Spree | 40 | Spend $88 at any merchant, 1–15 August | `spend_amount_at_merchant` (target 88, wildcard merchant) | 'SG Patriot' Badge | — | Event, 1–15 Aug |
| Travel Deals Week | 50 | Spend $100 at Scoot / AirAsia / Agoda / Booking.com / Klook | `spend_amount_at_merchant` (target 100) | 'Globetrotter' Badge | Klook $20 Voucher | Event, until 15 Dec |

---

## Rewards Marketplace Vouchers
12 total — sorted cheapest to most expensive, matching how the Marketplace
actually displays them (redeemable-first, then ascending points cost).

| # | Voucher | Points | Category | Discount | Min Spend | Availability | Validity After Redemption |
|---|---|---|---|---|---|---|---|
| 1 | **LiHO Tea** — $1 Voucher | 40 | Dining | $1 off | — | Unlimited, permanent | 30 days |
| 2 | **Grab** — $3 Ride Voucher | 180 | Transport | $3 off | — | Unlimited, permanent | 90 days |
| 3 | **Starbucks** — $5 Beverage Voucher | 240 | Dining | $5 off | — | Unlimited, permanent | 30 days |
| 4 | **Boost Juice** — $5 Voucher | 360 | Dining | $5 off | — | 100/day limit | 30 days |
| 5 | **Watsons** — $10 Off Voucher | 520 | Retail | $10 off | $15 | Unlimited, permanent | 45 days |
| 6 | **Starbucks** — $10 Beverage Voucher | 560 | Dining | $10 off | — | Unlimited, permanent | 30 days |
| 7 | **Groceries $10 Off Voucher** | 1,000 | Groceries* | $10 off | — | 50/day limit | 7 days |
| 8 | **Decathlon** — $10 Off Voucher | 1,200 | Retail | $10 off | $40 | 30/week limit | 45 days |
| 9 | **National Day 50% F&B Discount** | 1,300 | Dining* | 50% off, capped at $5 | — | Event: 1–15 Aug 2026, 100/day limit | 14 days |
| 10 | **Cotton On** — $15 Fashion Voucher | 1,400 | Retail | $15 off | $25 | 50/week limit | 45 days |
| 11 | **Travel 10% Off Voucher** | 2,000 | Travel* | 10% off, capped at $15 | — | 20/day limit | 10 days |
| 12 | **Klook** — $20 Year-End Travel Deal | 2,500 | Travel | $20 off | $80 | Event: 1 Nov – 20 Dec 2026, 200 total (never resets) | 7 days |

*Category-matched rather than tied to one specific merchant — applies at
**any** merchant within that category (Groceries, Dining/Coffee/Drinks, or
Travel respectively), not a single named brand. This is the same pattern
across all three: `merchantIds: ['any']` + `eligibleCategories`, treated
as a strict filter so it never accidentally matches outside that category.

---

## Notes

- **`visit_new_merchant`** and **`visit_count_at_merchants`** both depend
  on merchant-match data passed in through the transaction event hook —
  not just the transaction amount.
- **`streak_day`** depends on consecutive-day tracking stored separately
  from the quest itself.
- **Hour-gated quests** (Early Bird, Night Owl, Lunch Run) check the
  server's current time live when the transaction event fires.
- **Quest "families"**: templates sharing a family (e.g. Big Spender and
  Mid-Range Spender are both `spend-amount`) will never both appear in the
  same day's/week's rotation.
- **5 of the 8 partner challenges grant a real, usable voucher** on claim —
  not just a text label. That voucher shows up in My Vouchers exactly like
  a Marketplace redemption, tagged with which challenge it came from
  instead of a points cost.
- **Every voucher's redemption cost was doubled** from its original value
  as part of a broader points-economy rebalance (1 NETS Point = $1 spent,
  down from 10).


# ==================================================================================================================================
# ==================================================================================================================================
# ==================================================================================================================================


# ==================================================================================================================================
# =========================== JUN JIE'S CHANGE SUMMARY==============================================================================
# ==================================================================================================================================
# What Junjie did — for teammates

**Branch:** `Eron`  
**Owner:** Junjie (Home tab + Pay tab + related backend)  
**Read this first** if you are merging, deploying to Vercel, or using AI to combine branches.

---

## Summary in plain English

I did **two kinds of work**:

1. **Reorganised the Home tab** — split one huge `home.page` into smaller files (parent page + child components + services). Same features, easier to maintain.
2. **Added / fixed product behaviour** — wallet balance fixes, transaction pts/XP display, daily limit labels, PayNow naming, notifications, etc.

I did **not** refactor Pay, Travel, Rewards, or Payogotchi folders the same way. Pay is still mostly one big page. Payogotchi logic stays Calvin’s — I only connect to it through `PetBridgeService`.

---

## Part 1 — Home file structure (what changed)

### Before
Almost everything lived in one place:
- `home/home/home.page.ts` (~1200+ lines)
- `home/home/home.page.html` (very long)
- `home/home/home.page.scss` (very long)

### After
Home is split into **3 layers**:

```
src/app/pages/home/
│
├── home/                    ← PARENT (coordinator only, ~700 lines TS)
│   ├── home.page.ts         loads data, opens modals, handles navigation
│   ├── home.page.html       mostly <app-home-*> tags
│   └── home.page.scss       page chrome only
│
├── components/              ← CHILDREN (UI blocks on the Home screen)
│   ├── home-card-carousel/       card swipe + dots
│   ├── home-quick-actions/       Pay / Top Up / QR / More
│   ├── home-currencies/          Your Currencies + Exchange
│   ├── home-insight-card/        DNA insight teaser
│   ├── home-spending-summary/    month spend bars
│   ├── home-recent-transactions/ Recent list
│   ├── home-rewards-card/        NETS Points + XP bar
│   ├── home-secondary-actions/   shortcut grid
│   ├── home-add-card-modal/      link card popup
│   ├── home-top-up-modal/        top-up popup
│   └── home-notifications-modal/ bell notification list
│
├── services/                ← LOGIC (no HTML — API + mapping)
│   ├── home-wallet.service.ts    cards, balances, currency
│   ├── home-activity.service.ts  spending dashboard, recent txns
│   ├── home-top-up.service.ts    validate + submit top-up
│   └── home-alerts.service.ts    notification banners
│
└── home-qr-code/            ← still separate FULL PAGES (unchanged idea)
    home-all-transactions/
    home-more/
    home-ai-insights/
    … etc.
```

### How parent ↔ child works

| Layer | Role | Example |
|---|---|---|
| **Parent** `home.page.ts` | Owns selected card, modal open/close, refresh after pay/top-up | Opens top-up modal when user taps Top Up |
| **Child** `components/*` | Shows UI, emits events | `home-recent-transactions` displays rows; `(seeAll)` tells parent to navigate |
| **Service** `services/*` | Calls API, maps data | `home-activity.service` fetches dashboard and maps recent txns |

Pattern:
- `@Input()` — parent passes data **down** to child
- `@Output()` — child tells parent to **do something**

**Important:** Do **not** delete `components/` or `services/`. The parent page depends on them.

More detail: `team-md-files/home_updates_9 Aug.md`

---

## Part 2 — Feature & bugfix work (on top of the split)

These are **product changes**, not just moving files.

### Wallet & balance
- Card money uses **`multi_currency.SGD`** as truth (not old `balance` field alone).
- Fixed wrong “insufficient balance” / `$NaN` in some pay flows.

### Transactions (Recent + See all)
- Rows can show **+pts** and **+XP** on outgoing spend.
- **New** transactions store real rewards on the txn in Firestore.
- When daily cap hits and nothing is earned → grey **“Daily limit”** (not fake +0).
- When only partial XP left → shows **+200 XP** style leftover.
- **Old** transactions (before this change) still show **estimates** — we did not backfill history.

### PayNow / P2P
- Sender txn title: **PayNow (QR Code)** vs **PayNow (Mobile)** (by channel).
- Outgoing transfer earns **XP only**, not NETS Points.
- Toast when limit hit on Pay / QR pay screens.

### Home UX
- Rewards card: NETS Points + Payogotchi XP (or “hatch pet” teaser).
- More page: live **pts | XP** instead of static tier text.
- Kept **Your Currencies**; removed confusing duplicate FX preview panel.
- Low balance banner (< $50) + `points_received` notification formatting.

### Backend (needs to deploy with frontend)
- Persist `points_awarded` / `xp_gained` on transaction docs.
- New route: `PATCH /users/:userId/transactions/:txnId/rewards` (XP from client after pet bridge).

---

## Part 3 — What NOT to change (please read before editing)

Use this as a **do-not-touch / do-not-undo** list when merging, refactoring, or asking AI to “clean up” Home.

### A. Folders & files — do not delete or merge back

| Do NOT | Why |
|---|---|
| Delete `src/app/pages/home/components/` | Parent `home.page.html` renders these `<app-home-*>` tags |
| Delete `src/app/pages/home/services/` | Parent and children call these for API / mapping |
| Move all Home HTML back into `home.page.html` | Undoes the refactor; file becomes huge again |
| Move all Home logic back into `home.page.ts` | Same — we split on purpose for viva / review |
| Confuse `home-notifications/` (settings page) with `home-notifications-modal/` (bell popup) | Different screens; easy to break the wrong one |
| Delete `home-qr-code/`, `home-all-transactions/`, etc. | These are full routes opened from Home — not the same as `components/` |

### B. Home architecture — do not undo the pattern

| Do NOT | Why |
|---|---|
| Make child components call APIs directly for wallet/activity | Data flow should go through `home/services/` or parent orchestration |
| Remove `@Input()` / `@Output()` and use global state instead | Breaks the parent–child design we documented |
| Split Pay the same way without team agreement | Pay is still one large page; Home pattern is not automatic for Pay |
| “Simplify” by inlining modals back into `home.page.ts` | Top-up / add-card / notifications modals are intentionally extracted |

### C. Transaction rewards display — do not revert

| Do NOT | Why |
|---|---|
| Show only `estimateTxnRewards()` for **new** transactions | Ignores real grants and daily caps |
| Remove `resolveTxnRewardsDisplay()` | Single place that picks stored vs estimate + daily limit label |
| Show **+0 pts** / **+0 XP** when capped | Use grey **“Daily limit”** or **“Daily XP limit”** instead |
| Backfill / rewrite old Firestore txn docs with fake reward fields | We don’t know true historical grants; estimates are intentional |
| Remove `PATCH .../transactions/:txnId/rewards` or `updateTransactionRewards` | XP won’t persist on txn rows after PayNow / QR pay |
| Stop calling `recordTxnRewards()` from `qr-payments.service` / `transfers.service` | Same — rows won’t show honest XP |

### D. PayNow / transfer behaviour — do not change without discussion

| Do NOT | Why |
|---|---|
| Rename PayNow rows back to generic “P2P Transfer” only | We distinguish **PayNow (QR Code)** vs **PayNow (Mobile)** |
| Give NETS Points on outgoing Transfer category | Product rule: transfers earn **XP only** |
| Remove limit toasts on `pay.page.ts` / `home-qr-code.page.ts` | User feedback when daily cap is hit |

### E. Wallet & balance — do not regress

| Do NOT | Why |
|---|---|
| Read `card.balance` alone for spend / top-up / display | Use **`multi_currency.SGD`** (via `getCardFundsAmount` / card-utils) |
| Change top-up max in only one place | Must stay in sync: `wallet-config.js` **and** `wallet-topup.ts` |
| Remove the $50 source-card reserve check | Prevents topping up from an empty debit |

### F. Other teammates’ areas — do not refactor

| Do NOT | Why |
|---|---|
| Edit `src/app/pages/payogotchi/**` game logic | Calvin owns Payogotchi; Home/Pay use **`PetBridgeService.record()`** only |
| Rewrite `src/app/services/pet.service.ts` from Home/Pay work | Same boundary |
| Restructure `src/app/pages/travel/**` or `rewards/**` as part of Home merge | Separate owners / features |
| Modify `TransactionsService` core API shape without coordinating | Payogotchi bridge and Home both depend on txn records |

### G. Secrets & deploy — do not commit

| Do NOT | Why |
|---|---|
| Commit `src/app/security-stuffs-hehe/.env` or any API keys | Local only; gitignored |
| Commit Firebase service account JSON | Security risk |
| Deploy frontend without backend that has reward-persist routes | Daily limit rows and stored XP won’t work |

### H. Point / XP constants — do not change one side only

If you change earning rules, update **all** relevant places together:

| Constant | Backend | Frontend display |
|---|---|---|
| $1 = 1 pt | `transaction-rewards.js` `POINTS_PER_DOLLAR` | `txn-rewards-display.ts` `DISPLAY_POINTS_PER_DOLLAR` |
| $1 = 10 XP (estimate) | `pet.service.ts` (actual grant) | `txn-rewards-display.ts` `DISPLAY_XP_PER_DOLLAR` |
| 300 pts/day | `points-budget.js` | (from ledger — no separate UI constant) |
| Top-up $500 max | `wallet-config.js` | `wallet-topup.ts` |

### I. What is OK to change

| OK to change | Notes |
|---|---|
| Styles / colours in a specific `components/*` folder | Keep `@Input`/`@Output` contracts |
| Copy / labels on Home | Don’t break reward or balance logic |
| Pay tab (`src/app/pages/pay/`) | Junjie area, but not structurally split yet — coordinate before big refactors |
| Travel / Rewards / Payogotchi tabs | Their owners’ scope |
| Vercel / deploy config | Just wire API URL correctly |

---

## Part 4 — What I did NOT change (scope boundary)

| Area | Status |
|---|---|
| `src/app/pages/pay/` | **Not** split like Home (still large `pay.page.ts`) |
| `src/app/pages/payogotchi/` | Calvin owns — I only call `PetBridgeService.record()` |
| `src/app/pages/travel/` | Teammate area |
| `src/app/pages/rewards/` | Teammate area |
| Old Firestore txn docs | No backfill of reward fields |

---

## Part 5 — Shared files other tabs may use

If you edit these, check Home + Pay still work:

| File | Purpose |
|---|---|
| `src/app/utils/txn-rewards-display.ts` | pts/XP display + daily limit label |
| `src/app/utils/transfer-display.ts` | PayNow / P2P meta lines |
| `src/app/utils/wallet-topup.ts` | top-up limits ($1–$500, $5k wallet cap) |
| `src/app/services/qr-payments.service.ts` | QR pay + pet bridge + persist XP |
| `src/app/services/transfers.service.ts` | P2P/PayNow + pet bridge + persist XP |
| `backend/services/p2p-transfer.js` | transfer + PayNow labels |
| `backend/services/transaction-rewards.js` | points on merchant pay |

---

## Part 6 — Rules teammates should know

### Top-up
- Min **$1**, max **$500** per top-up, wallet max **$5,000**
- User **cannot** top up $600 (UI may type it; API rejects)

### NETS Points (per user, all cards share)
- **300 pts/day** total
- Max **20** purchase transactions that earn points per day
- **$1 = 1 pt** on merchant spend

### Payogotchi XP (separate system)
- **$1 = 10 XP** (display); daily cap by pet stage (200 / 400 / 600)
- Transfers: XP only, no pts

---

## Part 7 — Merge / deploy checklist

1. Pull branch **`Eron`** (or whatever branch has these commits).
2. Deploy **backend + frontend together** (reward persist won’t work on old backend).
3. On Vercel: frontend must reach live API (`/api` proxy or env URL).
4. Do **not** commit `.env` files.
5. Quick test: login → top-up $500 → QR pay → See all shows pts/XP or Daily limit.

---

## Part 8 — If you use AI to merge code

**Paste this prompt:**

> Read `team-md-files/junjie-home-pay-updates_12-Aug.md` **Part 3 (What NOT to change)**. Do not delete Home `components/` or `services/`. Do not collapse Home back into one page. Use `resolveTxnRewardsDisplay()` for txn rows. Do not backfill old transactions. Do not edit Payogotchi core logic.

Short reminders:

- Home uses **parent + `components/` + `services/`** — don’t collapse back into one giant page.
- Use **`resolveTxnRewardsDisplay()`** for transaction rows (don’t remove daily limit logic).
- Don’t refactor **Payogotchi** or backfill old transactions.
- **Pay tab** was not structurally split — don’t assume same pattern as Home unless we agree.

---

## One sentence for viva / demo intro

> I split the Home tab into a parent page, child components, and services for maintainability, then added honest transaction rewards (real grants + daily limit labels), PayNow channel naming, and wallet balance fixes — without changing Payogotchi’s core game logic.

# ==================================================================================================================================
# ========================================================= END ===================================================================
# ==================================================================================================================================


