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
