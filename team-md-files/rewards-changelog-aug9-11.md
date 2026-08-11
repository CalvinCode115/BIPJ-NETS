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

