# Technical Review — Prep Notes (Calvin / Payogotchi)

> Grounded in the actual code. Your feature is **Payogotchi**; the rest is your teammates'
> but you should be able to speak to the whole app at a high level.

---

## Q1. Features & general path (the "what is this app" answer)

**One-liner:** "It's a redesign of Singapore's NETS payment app for Gen Z — we turned a boring
utility app into a daily companion through gamification."

**5 bottom-nav tabs (the whole app):**
1. **Home** — payment overview, balances, spending insights
2. **Pay** — send/receive money, QR scan & pay
3. **Travel** — AI Travel Concierge (Eron)
4. **Rewards** — quests, points, marketplace, vouchers (Yunen)
5. **Payogotchi** — my virtual-pet gamification feature

**My feature's core path (new user):**
Egg Selection → Hatching Progress (5 transactions) → Hatching Animation → Naming → Home.
Then daily loop: make a NETS transaction → pet earns XP / restores hunger → feedback modal →
level-up → stage evolution. Care loop: hunger decays over days → pet faints → feed to revive.

**The core idea in one sentence:** the pet grows from *real spending behaviour* — spend on NETS,
your Tapatchi levels up; forget to use it, it gets hungry. Emotional attachment drives daily use.

---

## Q2. Technologies used & the pages

**Frontend**
- **Ionic 8** — mobile UI component framework (`ion-content`, `ion-modal`, `ion-toolbar`…)
- **Angular 20.3** — app framework. Mix of NgModule pages and standalone components.
- **TypeScript** — all logic. **SCSS** — styling (CSS custom properties from `theme/variables.scss`, never hardcoded hex).
- **Capacitor 8** — wraps the web app as a native iOS/Android app.
- Libraries: **chart.js** (spending charts), **@zxing/library / jsqr / qrcode** (QR pay), **ionicons**.

**Backends (there are two + a cloud DB):**
1. **Node/Express backend** (`backend/server.js`) on **port 3000** — the main NETS API
   (auth, transactions, transfers, QR payments, insights). Angular reaches it via a **proxy**:
   `proxy.conf.json` forwards `/api` → `http://localhost:3000`.
2. **Python FastAPI backend** (Eron's, `src/app/security-stuffs-hehe/main.py`) on **port 8000** —
   a "Travel Planner API" that proxies Google Places, WorldNews, Weather and Frankfurter FX rates.
3. **Firebase / Firestore** — the cloud database the Node backend talks to (with a local SQLite
   fallback for dev).

**How to describe "the pages":** they're organised by feature folder under `src/app/`. Each page
follows Angular's convention of 3 files: `.page.ts` (logic), `.page.html` (Ionic template),
`.page.scss` (styles), plus a routing/module file. My Payogotchi feature has ~21 screens under
`src/app/pages/payogotchi/`.

---

## Q3. The database (generic view)

- **Firestore** = a **NoSQL, document-based** cloud database (Google Firebase). Data is stored as
  **collections → documents → fields**, not tables/rows like SQL. Good for flexible, nested data
  and real-time sync.
- The Node backend seeds demo accounts (Alex, Sarah, Cheng) and stores transactions there.
- **My Payogotchi pet state uses `localStorage`** (browser storage) as the persistence layer —
  the whole pet (`level, xp, hunger, happiness, netsPoints, …`) is saved as JSON after every
  change and reloaded on refresh. *Firestore for the pet is designed but deferred* — the service
  is abstracted so swapping the storage layer touches zero screen code. (Say this exactly — it's
  the honest, professional framing.)
- **SQLite** exists as a local dev fallback (`backend/db/sqlite.js`).

Planned Firestore shape for the pet: `users/{uid}/payogotchi/{petId}` holding level, xp, hunger,
happiness, netsPoints, lastFedAt, cosmetics.

---

## Q4. "If you click this button, how does it run?" — trace a real flow

**Best example — my transaction button on the Payogotchi Home screen** (I know this cold):

1. User taps a demo transaction (e.g. 🍜 Lunch $12). The template calls `runTransaction(txn)`
   in `payogotchi-home.page.ts`.
2. That calls `petService.applyTransaction(amount, category, merchant)` — the **single source of
   truth** for pet logic (`pet.service.ts`). Inside it:
   - Ignores transactions under $0.50.
   - Base XP = `amount × 10`, capped at 250 per transaction.
   - Multiplies by the **happiness multiplier** (0.5×–1.2×).
   - Enforces the **daily XP cap** by stage (Baby 200 / Teen 400 / Adult 600), resetting on a new day.
   - If `category === 'food'`: restores hunger (`amount × 2`, max 40), and revives the pet if fainted.
   - Earns **NETS Points** = 10% of base XP.
   - Applies XP via `addXp()`, which rolls over levels and updates the stage (Baby/Teen/Adult).
   - **Saves to localStorage**, then **returns a `TransactionResult`** object.
3. Back in the component, the result drives the UI: it preps display data and opens the
   **feedback modal** (`showFeedback = true`).
4. **Celebration chain:** when the feedback modal is dismissed (`onFeedbackDismiss`), if the result
   says `leveledUp` it opens the **level-up modal**; when *that* dismisses, if `evolved` it opens the
   **evolution modal**. Each waits for the previous to close so they never overlap.
5. If the daily cap was hit, a top **toast** appears instead of a celebration.

> Key talking point: **the component doesn't contain game rules** — it just calls the service and
> reacts to the returned result. That separation (logic in the service, presentation in the page)
> is the clean-architecture point examiners look for.

**The full-stack version (a real NETS payment):** button → Angular service → HTTP `POST /api/...`
→ proxy → Express route → Firestore write → response → UI updates. Same shape, just with a network hop.

---

## Q5. "Two different policies"  ⚠️ *confirm which the lecturer means — here are the strongest candidates*

**(A) Firestore Security Rules** — literally two policies in `firestore.rules`:
```
allow read:  if true;               // anyone can READ (public data for the demo)
allow write: if request.auth != null;  // only AUTHENTICATED users can WRITE
```
So: **public read, authenticated-only write.** That's the cleanest "two policies" answer.
(You can note the read rule is permissive for the demo and would be tightened for production.)

**(B) CORS policy** — controls which web origins may call the backends:
- Express: `app.use(cors())` allows the Angular dev server to call `:3000`.
- FastAPI: `CORSMiddleware` explicitly allow-lists `localhost:4200 / 8100 / 8000`.

**(C) Game-design policies** (if they mean product rules): the **Daily XP Cap** policy (prevents
rich users dominating) and the **Egg-swap Trial policy** (free swaps in first 72h, then 50% XP
penalty + 30-day cooldown).

Lead with **(A)** unless the question context is clearly about networking (then B) or gameplay (then C).

---

## Q6. Chatbot — "how do you ensure it is sent?"  ⚠️ *no literal chatbot found in code — answer the "reliable request" version*

There isn't a chat-message feature in the codebase, so this is almost certainly about how a
**request to an external AI/API is reliably sent and returned**. Use Eron's FastAPI backend as the
concrete example:

- The frontend never calls Google/news APIs directly — it **sends a request to our own backend
  proxy** (`POST /api/...`), which keeps the **API keys secret** (in `.env`, server-side) and
  avoids browser CORS issues.
- The backend sends the outbound request with `requests.post(...)` and **guarantees delivery/error
  handling** with `try/except` + `raise_for_status()` — if the upstream fails, we return a clean
  error object instead of crashing.
- For images it uses a **`StreamingResponse`** so large payloads stream back in chunks.
- **CORS middleware** ensures the browser is *allowed* to send the request in the first place.

So "how I ensure it's sent" = **proxy through our backend + async HTTP call + error handling +
CORS allow-list + keys kept server-side.** If the lecturer means a specific chat feature, ask the
teammate who owns it — but this pattern is the answer to "how does a message get delivered."

---

## Q7. "Explain your code" — the framing that scores

Hit these themes:
- **Separation of concerns:** game rules live in `PetService`, screens only render + call it.
  One source of truth → consistent state everywhere, easy to test.
- **State management without Redux:** a single Angular service (`providedIn: 'root'`, a singleton)
  holds pet state — simple and appropriate for the project scale.
- **Persistence abstraction:** `save()` / `load()` wrap localStorage; swapping to Firestore later
  touches only the service, not the 21 screens.
- **Result-object pattern:** `applyTransaction()` returns a `TransactionResult` so the UI can
  orchestrate the celebration chain declaratively instead of the service knowing about modals.
- **Routing & guards:** onboarding order is enforced with an Angular route guard, so a user can't
  deep-link to "name your pet" with no pet. (This was the answer to the earlier lecturer question:
  unguarded routes are a *state* problem, fixed with guards + modals + conditional renders.)
- **Design system:** all colours/spacing come from `theme/variables.scss` CSS variables — no
  hardcoded hex — so theming is consistent and changeable in one place.

---

## Likely gotcha questions & crisp answers
- *"Why localStorage not a database?"* → Persistence layer is abstracted; localStorage is right for
  a client-side demo, Firestore schema is designed and swaps in behind the same interface.
- *"What stops XP farming?"* → Per-transaction cap (250), daily cap by stage, and the happiness
  multiplier — rewards consistent use over big spenders.
- *"Standalone vs module components?"* → Newer Payogotchi screens are standalone (Angular 17+ style);
  older ones use NgModules — Angular supports both.
- *"Where are secrets kept?"* → Server-side `.env`, never in the frontend bundle. (Make sure `.env`
  and `.venv` are git-ignored before you push!)

---

### ⚠️ Two housekeeping items before the review
1. `.env` (now holds real API keys) and the `.venv/` folder should be added to `.gitignore` so keys
   don't get committed. Ask me and I'll do it.
2. Be ready to demo the transaction → feedback → level-up chain live — it's your strongest moment.
