# Rewards System — Feature Overview

**Owner:** [your name]
**Tab:** Rewards
**Purpose of this doc:** a quick reference for the rest of the team on what
this feature does, how the 7 pieces fit together, and where your work touches
theirs — so nobody duplicates effort or builds something that conflicts with
it.

---

## 1. What this feature is

The Rewards tab is NETS's points/loyalty system. Users earn **NETS Points**
by using the app (spending, checking in, completing quests) and spend them
on vouchers, deals, or by sending points to friends. It has 7 screens:

1. Points History
2. Send Points to Friends
3. Daily Quests
4. Weekly Quests
5. Partner Challenges
6. Rewards Marketplace
7. My Vouchers

---

## 2. How points flow (the part everyone should know)

**Points are earned by:**
- Making a cash transaction at a merchant
- Checking in daily
- Receiving points sent from a friend
- Completing a daily quest, weekly quest, or partner challenge (claimed)

**Points are spent by:**
- Redeeming a voucher/deal in the Marketplace
- Sending points to a friend

This means **any transaction-related feature (Pay, Travel, QR payments,
receipts) is a trigger for this feature** — every time a user completes a
real transaction, quest/challenge progress needs to be updated, and points
need to be earned. See [Integration points](#4-integration-points-for-the-team)
below for the exact hook to call.

---

## 3. The 7 screens, in detail

### Points History
Shows a chronological list of every points transaction — both earned
(quests, challenges, check-ins, received transfers) and spent (voucher
redemptions, sent transfers). Each entry shows what happened, when, and the
amount (+/-).

### Send Points to Friends
PayNow-style transfer flow:
1. User enters a friend's contact number
2. App looks up the number and shows the payee's name — or "Payee not found" if unmatched
3. User picks an amount — either types it in, or taps a quick-amount chip (100 / 200 / 350 / 500)
4. Optional comment field
5. Confirm to send — deducts from sender's balance, credits the receiver, logs both sides in Points History

### Daily Quests
- 15 total quest templates exist; **5 are randomly selected as "today's quests"** for everyone, refreshing every day at 12:00am
- Completing a quest doesn't auto-grant points — a **"Claim Reward" button** appears, and the user must tap it
- Once claimed, the quest moves down into a **Completed** section

### Weekly Quests
- Same mechanic as daily, but harder requirements and bigger rewards
- 10 total templates; **3 are selected each week**, refreshing every Monday at 12:00am
- Same claim flow — completed quests need a **"Claim Reward"** tap, then move to a **Claimed** section

### Partner Challenges
- Sponsored by specific merchants, or tied to a special occasion (e.g. National Day month)
- Each challenge has a **duration type**: permanent, monthly (recurring), or occasion/event-based
- Each challenge has a **difficulty**: Easy / Average / Hard
- Shows how many other users have completed it (a live "42% of users completed this" style stat)
- **Important mechanic:** progress is opt-in. A user must tap **"Start Challenge"** before any of their spending counts toward it — e.g. if they spend $20 at the partner merchant *before* starting the challenge, it does not count
- Completing a challenge needs the same **"Claim Reward"** tap as quests
- Past (completed/expired) challenges remain visible in a history section

### Rewards Marketplace
- Users spend points here to redeem vouchers/deals
- Some vouchers are always available; others are **limited and occasion-based** — e.g. only 100 units/day of a "National Day 50% Off" voucher
- Tapping a voucher opens a **popup with full terms & conditions** before redeeming
- After redeeming, the voucher appears in **My Vouchers**

### My Vouchers
- Three tabs: **Available**, **Used**, **Expired**
- **Used** vouchers show when/where they were used
- Tapping an **Available** voucher opens a popup with terms & conditions and usage steps
- **How a voucher gets used:** no code to enter and nothing to expire in 15
  minutes. When the user pays a merchant via NETS QR payment, the app
  automatically checks whether they hold an unused voucher valid for that
  merchant, and — if so — applies the discount at checkout with no extra
  action from the user. Immediately after, the voucher moves from
  **Available** to **Used**, stamped with the real transaction's date, time,
  and merchant location (the same details already captured by the payment
  itself).
- This means voucher usage is **detected at the moment of payment**, not
  triggered by the Rewards tab at all — see [Integration
  points](#4-integration-points-for-the-team) below for what this requires
  from whoever owns the Pay/QR flow.

---

## 4. Integration points for the team

If your feature involves the user spending money or completing an action in
the app, here's what you need to know:

- **After any successful transaction** (Pay, QR payment, Travel booking,
  etc.), call the quest/challenge event hook so progress stays in sync:
  ```
  POST /api/users/:userId/quests/events
  body: { eventType: 'transaction', amount, merchantId, merchantCategory, isNewMerchant }
  ```
  Without this call, users' quest/challenge progress will never update no
  matter how much they spend elsewhere in the app.

- **The points balance lives on `users/{userId}.points`** in Firestore —
  the same field the rest of the app already reads for tier/points display.
  Don't create a separate points field elsewhere; read/write this one so
  everything stays consistent.

- **Bill-splitting (Payogotchi/social features):** if your feature lets
  users split a bill with friends via NETS, that should also fire a quest
  event (`eventType: 'bill_split'`) — one of the weekly quests specifically
  tracks this.

- **New-merchant detection:** a few quests/challenges require visiting a
  merchant the user hasn't been to before. If your feature already tracks
  "have I paid this merchant before," pass that through as `isNewMerchant`
  in the event call above — otherwise this logic will need to be added.

- **⚠️ Voucher auto-apply during QR payment (new, needed for My Vouchers):**
  vouchers are no longer used via a manual code — they're detected and
  applied automatically at the moment of NETS QR payment. This needs a hook
  in the Pay/QR payment flow itself:
  1. Right before confirming a QR payment, check if the paying user has any
     **available** (unused, unexpired) voucher whose merchant matches the
     one being paid.
  2. If yes, apply the voucher's discount to the payment amount and show the
     user that a voucher was applied before they confirm.
  3. On successful payment, mark that voucher as **used**, recording the
     real transaction's merchant, location, date, and time — no separate
     "use now"/code step needed.

  This is a bigger ask than the quest event hook above, since it needs to
  run *before* payment confirmation, not just after. Whoever's building
  QR/Pay, let's sync on this specifically — happy to write the exact
  check/apply function for you to call.

---

## 5. Screens at a glance

```
Rewards (home)
 ├─ Points Balance ──────► Points History
 │                    └──► Send Points to Friends
 ├─ Daily Quests
 ├─ Weekly Quests
 ├─ Partner Challenges
 ├─ Rewards Marketplace
 └─ My Vouchers (Available / Used / Expired)
```
