NETS Wallet — team guide


First-time clone
----------------

You need Node 22 or newer (backend uses built-in SQLite).

From the project root(terminal):

  npm install
  cd backend
  npm install
  cd ..

Run everything (backend on port 3000, Ionic app on port 8100):

  npm start

That is the usual first-time flow. On first backend start, if wallet.db does not exist yet, tables are created and seed accounts Alex, Sarah, and Cheng are loaded.

Open the app at http://localhost:8100. Log in with any seed account (see Seed accounts below).

Optional: regenerate receipt images and JSON catalogs (only needed if you change scripts/ or catalog data):

  npm run generate:assets


GitHub — Path A (clone team repo)
---------------------------------

Use this when the team repo already exists on GitHub and you start from Calvin's template instead of pushing your old folder directly.

Team repo: https://github.com/CalvinCode115/BIPJ-NETS.git

Rules from the team README:
  Never commit directly to main — always work on your own branch.
  Branch name format: yourname/feature-description (e.g. junjie/home-and-pay).

Prerequisites on your PC
  Node.js 22+ (this project needs 22 for backend SQLite)
  Git — https://git-scm.com/ (during install, choose "Git from the command line and also from 3rd-party software")
  Ionic CLI (optional): npm install -g @ionic/cli

If git is not recognized in Cursor terminal after installing Git:
  1. Fully quit Cursor (File → Exit), reopen the project, open a new terminal.
  2. Or run once in PowerShell:
       $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  3. Or use full path: & "C:\Program Files\Git\bin\git.exe" --version

Step 1 — Clone the team repo (Path A)

  cd C:\Users\junji\OneDrive\Documents\ionicapp
  git clone https://github.com/CalvinCode115/BIPJ-NETS.git
  cd BIPJ-NETS

This creates a new folder BIPJ-NETS separate from your local bipj_jie work folder.

Step 2 — Open the cloned repo in Cursor

  File → Open Folder → ...\ionicapp\BIPJ-NETS

Do Git work from BIPJ-NETS, not from the old bipj_jie folder.

Step 3 — Create your branch (do not stay on main)

  git checkout main
  git pull origin main
  git checkout -b junjie/home-and-pay

In Cursor: click branch name bottom-left → Create new branch → junjie/home-and-pay.

Step 4 — Copy Jun Jie's work from bipj_jie into BIPJ-NETS

Folder names in bipj_jie now match the team layout (home/, pay/, not tab1/tab2). Copy these into the cloned repo, replacing template files where they overlap:

  From bipj_jie                          Into BIPJ-NETS
  --------------------------------       ----------------
  src/app/home/                          src/app/home/
  src/app/home-*/                        src/app/home-*/
  src/app/pay/                           src/app/pay/
  src/app/pay-scan-qr/                   src/app/pay-scan-qr/
  src/app/tabs/                          src/app/tabs/          (if routing changed — coordinate with team lead)
  src/app/services/                      src/app/services/
  src/app/utils/                         src/app/utils/
  src/app/core/                          src/app/core/
  src/app/login/                         src/app/login/           (if you own auth)
  src/app/signup/                        src/app/signup/
  backend/                               backend/
  scripts/                               scripts/
  shared/                                shared/
  proxy.conf.json                        proxy.conf.json
  package.json                           package.json             (merge carefully — do not drop teammates' scripts)
  guide.md                               guide.md                 (optional — or keep team README + this guide)

Also copy if present:
  src/assets/demo-receipts/
  src/assets/demo-qr/
  src/assets/nets-logo.png               (team README asks for this in src/assets/)

Do not overwrite other teammates' tab folders unless agreed:
  src/app/tab3/   (Travel — Eron)
  src/app/tab4/   (Rewards)
  src/app/tab5/   (Payogotchi)

Step 5 — Install and test in BIPJ-NETS

  npm install
  cd backend
  npm install
  cd ..
  npm run generate:assets
  npm start

Open http://localhost:8100 — log in with a seed account (see Seed accounts below).

Step 6 — Commit and push your branch

  git status
  git add .
  git commit -m "Add home and pay tabs with backend API"
  git push -u origin junjie/home-and-pay

Step 7 — Open a Pull Request on GitHub

  Go to https://github.com/CalvinCode115/BIPJ-NETS
  Click Compare & pull request for junjie/home-and-pay → main
  Ask Calvin / team lead to review and merge

Do not merge into main yourself unless the team lead says so.

Cursor / VS Code Git shortcuts
  Source Control: Ctrl+Shift+G
  Sign in to GitHub: account icon bottom-left
  Pull: Sync or git pull origin main (while on your branch, rebase/merge as team prefers)
  Push: Publish Branch after first commit on a new branch

Two folders on your PC (normal during Path A)

  bipj_jie/     Your original working copy — reference or copy from
  BIPJ-NETS/    Team GitHub clone — use this for commits and PRs

After your PR is merged, you can delete the extra folder or keep working only in BIPJ-NETS.

Firebase (later — frontend hosting)
  Firebase Hosting serves the built app (www/ after ng build).
  The Express + SQLite backend still needs a separate host (e.g. Render, Railway).
  Team lead sets up Firebase project and GitHub deploy; ask to be added in Firebase Console → Users and permissions.

Quick Path A checklist
  [ ] Git works (git --version)
  [ ] Cloned BIPJ-NETS
  [ ] Branch junjie/home-and-pay created (not main)
  [ ] Copied home/, pay/, backend/, scripts/ from bipj_jie
  [ ] npm install + npm start works locally
  [ ] Pushed branch and opened PR


Every other time (returning to the project)
-------------------------------------------

From the project root:

  npm start

You do not need to reinstall unless package.json changed or node_modules was deleted.

Backend only (separate terminal):

  cd backend
  npm start

Frontend only (backend must already be running):

  npm run start:app or ionic serve

Normal restarts do not wipe your database. Linked cards, new signups, transactions, and notifications are kept.


What wipes data
---------------

| Action                         | Data lost? |
|--------------------------------|------------|
| npm start (normal restart)     | No         |
| npm run db:seed (in backend/)  | No — merges seed accounts only |
| npm run db:seed:reset          | Yes — full wipe, fresh Alex/Sarah/Cheng |
| Delete backend/data/wallet.db  | Yes — next start recreates DB + seed |

Backup wallet.db:

  cd backend
  copy data\wallet.db data\wallet.backup.db


These are real rows in wallet.db

| User          | Phone    | PIN    |
|---------------|----------|--------|
| Alex Tan      | 91234567 | 123456 |
| Sarah Lim     | 87654321 | 123456 |
| Cheng Wen Mao | 80680505 | 123456 |
| Adam Liew     | 84688831 | 123456 |

All four seed accounts are loaded when the database is seeded (npm run db:seed:reset in backend/).


SQLite database (wallet.db)
---------------------------

The backend stores all live user data in a single SQLite file:

  backend/data/wallet.db

This file is gitignored — each developer has their own local copy. It is created automatically on first npm start if it does not exist.

Requirements: Node 22+ uses the built-in node:sqlite module (no extra native install on Windows).

Schema and migrations
  backend/db/migrations/001_init.sql   — creates tables
  backend/db/migrations/002_transfer_fields.sql — adds PayNow transfer columns on transactions

Migrations run automatically when the server starts (via backend/db/sqlite.js). You rarely need to run npm run db:migrate manually.

Tables in wallet.db

| Table           | What it stores |
|-----------------|----------------|
| users           | id, name, phone, pin, tier, points, email |
| cards           | linked NETS cards per user (prepaid, cashcard, others), balance, credit limit |
| transactions    | every spend, top-up, salary credit, PayNow in/out — merchant, category, amount, date |
| notifications   | in-app alerts (e.g. PayNow received) |
| app_meta        | internal flags (e.g. seed version) |

There is no dna_profiles or insights table. DNA and insights are computed from the transactions table at request time.

Transaction row (typical spend)
  id, user_id, card_id, merchant, category, subtitle, amount (negative = spend),
  txn_type, icon, icon_color, occurred_at

PayNow rows also use transfer_direction, counterparty_phone, counterparty_name, transfer_id (from migration 002).

What is NOT in SQLite
  home-receipts.json and pay-qr-merchants.json in backend/data/ are static scan catalogs (receipt images, QR merchants). They are JSON files, not SQL tables. Regenerate with npm run generate:assets from the project root.

How data gets written
  Seed: backend/seed-data.js loaded on empty DB (Alex, Sarah, Cheng + sample history)
  Runtime: pay, receipt scan, QR pay, card link, P2P transfer — all call db.addTransaction() or similar in backend/db.js

Useful SQL examples (run in SQLite Viewer or DB Browser)

  -- All users
  SELECT id, name, phone FROM users;

  -- One user's recent spends
  SELECT merchant, category, amount, occurred_at
  FROM transactions
  WHERE user_id = 'user_1' AND amount < 0
  ORDER BY occurred_at DESC
  LIMIT 20;

  -- Monthly spend by category
  SELECT category, SUM(ABS(amount)) AS total
  FROM transactions
  WHERE user_id = 'user_1' AND amount < 0
  GROUP BY category
  ORDER BY total DESC;

Viewing wallet.db
  Cursor / VS Code: install the SQLite Viewer extension, open backend/data/wallet.db
  Or: DB Browser for SQLite (https://sqlitebrowser.org/)

Backup before a reset
  cd backend
  copy data\wallet.db data\wallet.backup.db


Project structure
-----------------

bipj_jie/
  guide.md                 This file
  package.json             Root scripts; npm start runs backend + Ionic together
  proxy.conf.json          Dev proxy so the app calls localhost:3000/api
  scripts/                 Build-time asset generators (not runtime)
    home-receipts-data.mjs
    pay-qr-data.mjs
    generate-home-pay-assets.mjs
    home-receipt-image-hash.mjs
  shared/
    api-contract.ts        Shared TypeScript types for frontend ↔ backend
  src/                     Ionic / Angular app
    app/
      home/                Home tab (route: /tabs/home)
      home-card-management/
      home-full-report/
      home-ai-insights/
      home-all-transactions/
      home-more/
      home-security-privacy/
      home-qr-code/
      pay/                 Pay tab (route: /tabs/pay)
      pay-scan-qr/
      tab3/                Travel tab — Eron’s area (route: /tabs/travel)
      tab4/                Rewards tab (route: /tabs/rewards)
      tab5/                Payogotchi tab (route: /tabs/payogotchi)
      login/ signup/
      services/            HTTP clients (auth, cards, transactions, receipts, QR pay, …)
      core/api.config.ts   API base URL
    assets/
      demo-receipts/       Receipt PNGs for Home scan
      demo-qr/             Merchant QR PNGs for Pay
  backend/
    server.js              Express entry
    db.js                  Data access layer
    data/
      wallet.db            Live SQLite DB (gitignored)
      home-receipts.json   Home receipt scan catalog
      pay-qr-merchants.json Pay QR merchant catalog
    db/migrations/         SQL schema
    seed-data.js           Alex / Sarah / Cheng seed content
    routes/                auth, api
    services/              DNA, insights, payments, transfers, notifications, …


Team areas
----------

| Area              | Owner        | Main code / routes |
|-------------------|--------------|--------------------|
| Home, cards, pay  | Jun Jie      | home/*, pay/*, transactions, dashboard |
| Insights UI       | Jun Jie      | home-ai-insights, GET /users/:id/insights |
| Travel concierge  | Eron         | tab3/*, GET /users/:id/dna-profile |
| Payogotchi        | Calvin/Yunen | tab5/* (optional: points from transactions) |

API base URL (local): http://localhost:3000/api


How User DNA and Smart Insights are derived
-------------------------------------------

Both come from the same pipeline in the backend. There is no AI model — only rules over transaction rows in wallet.db.

Source code
  backend/services/dna.js           — buildDnaProfile, buildInsights
  backend/services/insight-engine.js — deriveDnaTraits, pickSmartInsights
  backend/services/merchant-tags.js  — merchant → tag mapping
  backend/services/insight-deep-dives.js — food / retail / travel chart buckets
  backend/services/top-spots.js      — favourite merchants by spend

Step 1 — Load transactions
  The API loads all rows for the user from the transactions table.
  Optional query params month and year (default: current month) select which calendar month to analyse.

Step 2 — Lifestyle expenses only
  Rows are kept only if:
    amount is negative (money out)
    category is not Transfer (PayNow / top-ups are excluded from lifestyle DNA)

  Credits (salary, incoming PayNow) are ignored for traits and insights but still exist in the DB.

Step 3 — Merchant tags
  Each expense row gets one or more tags from backend/services/merchant-tags.js:

  1. Match merchant name against pay-qr-merchants.json tags (e.g. Starbucks → drink_coffee)
  2. Else match a static list (Grab → transport_ride, Agoda → travel_hotel, …)
  3. Else fall back to category (Coffee → drink_coffee, Dining → food_casual, Travel → travel_other, …)

  Tags are aggregated per month: total dollars and visit count per tag.
  Examples: drink_coffee, drink_bubble_tea, food_hawker, groceries, retail_fashion,
  travel_flight, travel_hotel, travel_activity, transport_ride, health_wellness

Step 4 — DNA traits (deriveDnaTraits)
  Each possible trait gets a score from the month’s spend. Traits with score > 0 are ranked
  by score descending. Up to 4 labels are returned. If none match, the user gets Balanced Spender.

  | Trait              | Rough rule (must exceed threshold) |
  |--------------------|-------------------------------------|
  | Travel Explorer    | flight + hotel tag spend ≥ $80 |
  | Wellness Focused   | pharmacy tag + Health category ≥ $35 |
  | Home Chef          | Groceries ≥ 22% of lifestyle spend |
  | Savvy Shopper      | fashion tag ≥ $40 OR Retail ≥ 28% of spend |
  | Active Lifestyle   | retail_sports tag ≥ $30 |
  | Food Explorer      | Dining ≥ 22% of lifestyle spend |
  | Coffee Lover       | drink_coffee ≥ $18 OR ≥ 3 coffee visits |
  | Bubble Tea Fan     | drink_bubble_tea ≥ $12 OR ≥ 2 visits |
  | Kopitiam Regular   | drink_milo + food_hawker tags ≥ $35 |
  | On-the-go Commuter | Transport ≥ 18% of lifestyle spend |
  | Budget Conscious   | total lifestyle spend ≤ $300 |

  The same trait list is used for Home (dnaTraits), Insights page, and dna-profile.

Step 5 — DNA profile fields (buildDnaProfile)
  Used by GET /users/:userId/dna-profile and partially by /insights.

  topCategories
    Sum absolute amount per category (Coffee, Dining, Travel, …), sort highest first.
    Each row includes share = category amount ÷ total lifestyle spend.

  topMerchants
    Count visits per merchant name, take top 5 by visit count (not dollar amount).

  avgDailySpend
    Total lifestyle spend for the month ÷ 30.

  travelHints.preferredCuisines
    Built from category/merchant signals:
      Japanese — if Japanese category or Ichiban Sushi visits
      Coffee — if any coffee category spend
      Local Dining — if any Dining spend
      Regional Travel — if any Travel category spend
    Default: Local Dining if nothing else matches.

  travelHints.budgetStyle
    total lifestyle spend ≤ $400  → budget
    total lifestyle spend ≤ $800  → moderate
    above $800                    → premium

  travelHints.typicalTripSpend
    total lifestyle spend × 1.2 (simple estimate, not a saved user preference).

Step 6 — Smart insights (pickSmartInsights)
  Used by GET /users/:userId/insights and the Home dashboard teaser (first card only).

  Each insight template has:
    a score function — returns 0 if the pattern does not apply, otherwise a positive number
    a build function — title, message, icon, colour for the UI

  Templates (backend/services/insight-engine.js):

  | Template id   | Theme     | Activates when (summary) |
  |---------------|-----------|---------------------------|
  | bubble_tea    | drinks    | bubble tea tag spend ≥ $6 |
  | coffee        | drinks    | coffee ≥ $8 and beats bubble tea |
  | local_drinks  | drinks    | milo + soy + juice tags ≥ $6 |
  | dining        | food      | Dining category ≥ $15 |
  | groceries     | groceries | Groceries ≥ $25 |
  | fashion       | retail    | retail_fashion tag ≥ $20 |
  | pharmacy      | retail    | retail_pharmacy tag ≥ $12 |
  | travel        | travel    | flight + hotel + activity tags ≥ $50 |
  | wellness      | wellness  | Health category + clinic tag ≥ $20 |
  | transport     | transport | Transport category ≥ $12 |
  | sports        | retail    | retail_sports tag ≥ $25 |

  Picking logic:
    1. Score every template against the month’s context.
    2. Drop templates with score 0, sort by score highest first.
    3. Take up to 3 cards, but only one per theme (drinks, food, retail, …) so the UI is not repetitive.
    4. Always append a 4th card: the user’s top DNA trait (trophy icon), unless that trait title
       was already used as a card title.
    5. Return at most 4 cards total.

  Message text is templated with real numbers from the user’s month (e.g. “You spent $24.50 on coffee in Jun 2026”).

Step 7 — Rest of the Insights response (buildInsights)
  Alongside smartInsights and traits, /insights also builds:

  summaryStats — total spent, transaction count, average per day for the month
  foodDonut / shoppingDonut — pie segments from category totals
  deepDives — sub-buckets (Coffee vs Bubble Tea vs Japanese, Flights vs Hotels, …)
              using merchant name maps in insight-deep-dives.js
  topSpots — top merchants by dollar spend (excludes top-ups and PayNow)
  transportAnalysis — transport category total and top transport merchant
  availablePeriods — list of months that have any transactions (for month picker)

Step 8 — Wallet-wide scope
  All card types (prepaid, cashcard, others) feed DNA and insights.
  Card filters on the Home carousel only change dashboard categories and recent transactions —
  they do not change traits or smart insights.

When data updates
  New pay / receipt scan / QR payment → new transaction row → next API call recomputes everything.
  No background job and no dna_profiles table.


How Insights appear in the app (Home tab)
-----------------------------------------

  GET /users/:userId/insights?month=&year=  — full Insights page (home-ai-insights)
  GET /users/:userId/dashboard              — Home teaser uses smartInsights[0] + dnaTraits


How User DNA is exposed for Travel (Eron)
-----------------------------------------

Eron’s main integration point:

  GET /users/:userId/dna-profile?month=&year=

Returns the Step 5 fields (traits, topCategories, topMerchants, avgDailySpend, travelHints).
See example shape below. Types: shared/api-contract.ts → DnaProfile.

Example response:

  {
    "userId": "user_1",
    "traits": ["Food Explorer", "Coffee Lover"],
    "topCategories": [{ "category": "Dining", "amount": 24, "share": 0.21 }],
    "topMerchants": ["Starbucks Raffles Place", "Grab"],
    "avgDailySpend": 8.5,
    "travelHints": {
      "preferredCuisines": ["Coffee", "Local Dining"],
      "budgetStyle": "budget",
      "typicalTripSpend": 102
    },
    "updatedAt": "2026-06-23T12:00:00.000Z"
  }

Eron can call this from tab3 without reimplementing trait or travelHints logic.


What information can be extracted (for Travel / Eron)
-----------------------------------------------------

All of this comes from wallet transaction history (SQLite). Nothing is a separate saved “DNA record” — it is computed when you call the API.

Primary endpoint for Travel

  GET /users/:userId/dna-profile?month=6&year=2026

Returns:
  traits — up to 4 lifestyle labels (e.g. Travel Explorer, Coffee Lover, Savvy Shopper, Wellness Focused)
  topCategories — category name, dollar amount, share of wallet (0–1)
  topMerchants — top 5 merchants by visit count
  avgDailySpend — monthly lifestyle spend ÷ 30
  travelHints.preferredCuisines — e.g. Coffee, Local Dining, Regional Travel, Japanese
  travelHints.budgetStyle — budget | moderate | premium (from monthly spend tiers)
  travelHints.typicalTripSpend — rough trip budget (monthly spend × 1.2)

Richer endpoint (optional — same engine, more UI-oriented fields)

  GET /users/:userId/insights?month=&year=

Also includes:
  summaryStats — total spent, transaction count, average per day
  foodDonut / shoppingDonut — category breakdown charts
  deepDives — food vs retail sub-breakdowns (coffee, hawker, fashion, flights, hotels, etc.)
  topSpots — favourite merchants by spend (excludes top-ups and transfers)
  transportAnalysis — Grab / transit style patterns
  smartInsights — short narrative cards (coffee habit, bubble tea, travel spend, …)
  availablePeriods — which months have data (for a month picker)

Raw history (if Travel needs its own logic)

  GET /users/:userId/transactions
  Filters: ?category=Travel, ?search=agoda, ?cardType=prepaid, ?type=expenditure

Merchant tags (used internally for traits — not a separate API today)
  Examples: travel_flight, travel_hotel, travel_activity, drink_coffee, food_hawker,
  groceries, retail_fashion, transport_ride, health_wellness
  Mapped from merchant name + category in backend/services/merchant-tags.js

Trait labels the engine can produce
  Travel Explorer, Wellness Focused, Home Chef, Savvy Shopper, Active Lifestyle,
  Food Explorer, Coffee Lover, Bubble Tea Fan, Kopitiam Regular, On-the-go Commuter,
  Budget Conscious, Balanced Spender (fallback)

What we do not extract today
  GPS / location coordinates
  Real airline or hotel booking APIs
  Cross-user comparisons or cohort stats
  LLM-generated text (insights are rule-based templates)
  A persisted DNA snapshot — always live from transactions

When the user pays or scans a receipt, a new transaction row is saved and DNA / travelHints change on the next API call.


Is User DNA saved in the database?
----------------------------------

There is no dna_profiles table. DNA is not stored as a separate saved profile.

What is saved: every transaction (merchant, category, amount, date, card) in wallet.db. Pay, receipt scan, QR pay, and P2P transfer all append rows via db.addTransaction().

What is computed on each request: traits, travelHints, smart insights, and category breakdowns are recalculated from those transactions when you hit /insights, /dna-profile, or /dashboard.

So when a user spends more, their DNA updates automatically on the next API call — because the underlying transactions changed, not because something wrote a DNA row. The updatedAt field in dna-profile is the time the profile was computed, not a stored “last saved DNA” record.

If you wipe wallet.db or run db:seed:reset, transaction history resets and DNA resets with it.


Useful backend commands (from backend/)
---------------------------------------

  npm start              Run API (safe; keeps data)
  npm run db:seed        Refresh seed accounts without wiping other users
  npm run db:seed:reset  Full database reset


Key API routes (quick reference)
--------------------------------

  GET  /health
  POST /auth/login
  GET  /auth/me
  GET  /users/:userId/cards
  GET  /users/:userId/transactions
  GET  /users/:userId/dashboard
  GET  /users/:userId/insights
  GET  /users/:userId/dna-profile
  GET  /home/receipts
  GET  /pay/qr-merchants
  POST /users/:userId/payments/qr
  POST /users/:userId/receipts/scan

View wallet.db: see SQLite database section above.
