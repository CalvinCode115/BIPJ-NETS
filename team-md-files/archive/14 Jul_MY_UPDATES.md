# Team updates — Home / Pay / Top-up / FX display

**Changes made by:** Jun Jie (Home, cards, payments)  
**Audience:** Group mates integrating with Home / Pay / Travel FX  
**Date:** 14 Jul 2026 before 1am

This note summarizes recent local changes (not yet necessarily committed). Restart the **Node backend** after pulling so API changes load.

---

## 1. Home — “Also in your currencies” (FX display)

### What
Eron’s approach: **SGD stays on the card**; users **add** currencies to a personal list under the carousel. Converted amounts are **display-only** (Pay / QR / Top-up still use SGD).

### Behaviour
- Empty list by default → **Add currency** sheet
- Choices come from Travel `DESTINATIONS` (MYR, THB, JPY, KRW, AUD)
- Converted amount = `card SGD balance × rate`
- **Per-user preference:** list is stored as `localStorage` key `nets_home_tracked_currencies_<userId>` (e.g. Sarah can keep MYR+KRW, Cheng can keep JPY). Older shared key `nets_home_tracked_currencies` is migrated once then removed.
- Rates (same pipeline as Travel FX FAB):
  1. Call Eron’s `FxTrackerService.getFxInsightWithPrediction` → Python `:8000` → **Frankfurter** live SGD→currency
  2. If API/uvicorn is down → Home uses demo fallbacks (MYR ≈ **3.15**, not the old 3.48)
- Home and Travel **share** the FX cache. Demo/fallback rates are **no longer written into that cache** for 1 hour (that bug made Travel show ~3.47 after a failed call even when live MYR was ~3.15). Clear `localhost:8100` Local Storage if you still see a stale rate after pulling.

### Files
| File | Change |
|------|--------|
| `src/app/pages/home/home/home.page.ts` | Per-user tracked list, add/remove, rate refresh, formatting, MYR fallback ~3.15 |
| `src/app/pages/home/home/home.page.html` | Currency panel + add sheet; card shows SGD badge (no dropdown) |
| `src/app/pages/home/home/home.page.scss` | Styles for panel + sheet |
| `src/app/utils/card-display.ts` | Optional currency helpers (card face still SGD) |
| `src/app/services/destination.config.ts` | **Unchanged** — still shared with Travel (do not edit without telling Eron) |
| `src/app/pages/travel/fx-tracker/fx-tracker.service.ts` | **Updated** — do not cache fallback FX; empty history treated as failure; demo SGD→MYR aligned to ~3.15 |

### Note for Eron / Travel
Home only **reads** `DESTINATIONS` + `FxTrackerService` (does not own Frankfurter / `main.py`). Expanding to “any currency” later is Travel/FX scope. If Travel FAB rate looks wrong after Home currency work, clear browser FX cache (`nets_fx_*`) or Local Storage for `:8100`, keep uvicorn on `:8000`, then hard refresh.

### How to run FX for correct rates
```bash
cd "src/app/security stuffs hehe"
python -m uvicorn main:app --reload --port 8000
```
Expect ~**3.15 MYR** live (not ~3.47). Weather `200` alone does not mean FX ran — look for `POST /api/fx/history`.

---

## Full file guide (everything Jun Jie changed — for teammates)

Use this as a map of **which files moved** and **why**. After pull: restart **Node** (`npm start`) for backend route changes; keep **uvicorn :8000** if testing FX.

### Home / currencies / low-balance / add-card

| File | What changed |
|------|----------------|
| `src/app/pages/home/home/home.page.ts` | Per-user currency list; FX rate refresh; low-balance soft-dismiss (banner returns until top-up ≥ $50 or Notifications → Low balance off); dynamic card expiry check; add-card input sanitizers write back to `ion-input` |
| `src/app/pages/home/home/home.page.html` | “Also in your currencies” panel + add sheet; SGD badge; top-up spinner; insight eyebrow unchanged (rule-based) |
| `src/app/pages/home/home/home.page.scss` | Currency panel/sheet styles; top-up spinner styles |

### FX shared with Travel (Eron — please read)

| File | What changed |
|------|----------------|
| `src/app/pages/travel/fx-tracker/fx-tracker.service.ts` | **Do not cache** demo/fallback FX for 1 hour; empty `/fx/history` treated as failure; demo SGD→MYR ≈ 3.15. Fixes Travel FAB stuck on ~3.47 after Home currency calls |
| `src/app/services/destination.config.ts` | **Not edited** — Home only reads it |

#### Detail: `fx-tracker.service.ts` — what changed, line by line

**Problem (why we edited this file)**  
Home “Also in your currencies” and Travel’s green FX FAB both call `getFxInsightWithPrediction`. They share `CacheService` keys like `nets_fx_malaysia` (kept **1 hour**). If the live call failed once, the service built a **demo** rate near **3.48** (UI showed ~**3.47**), then **cached** it. Travel kept showing 3.47 even when Frankfurter live was ~**3.15**. Restarting uvicorn does **not** clear that browser cache.

---

**Change A — Demo SGD→MYR base rate** (`DEMO_RATES`, ~lines 44–46)

| | |
|--|--|
| **Original** | `'SGD-MYR': 3.48`, `'MYR-SGD': 0.287` |
| **Now** | `'SGD-MYR': 3.15`, `'MYR-SGD': 0.317` |
| **Why** | Offline/demo fallback should be closer to current market (~3.12–3.15). Old 3.48 made “fallback” look like a wrong live rate. |

---

**Change B — Only cache live insights** (`getFxInsightWithPrediction` → `map`, ~lines 76–84)

| | |
|--|--|
| **Original** | Always `this.cache.set(cacheKey, result, destination.id)` after building prediction — **including** when `history` came from the demo generator. |
| **Now** | Cache only if history is **not** marked fallback: `if (!(history as …).isFallback) { this.cache.set(...) }` |
| **Why** | Stop saving fake ~3.47 into the shared 1-hour cache so Home currency refresh cannot poison Travel FAB. |

```ts
// NOW (conceptually)
const result = { ...history, prediction };
if (!(history as FxInsight & { isFallback?: boolean }).isFallback) {
  this.cache.set(cacheKey, result, destination.id);
}
return result;
```

---

**Change C — Empty FX API body = failure** (`fetchFxHistory` → `map`, ~lines 103–109)

| | |
|--|--|
| **Original** | Any HTTP 200 response was transformed and cached, even if `rates` was `{}`. |
| **Now** | If `!res?.rates` or `Object.keys(res.rates).length === 0`, `throw new Error('Empty FX history from API')` → hits `catchError` → demo path (and that demo is **not** cached as live — see B + D). |
| **Why** | Python can return `{ error, rates: {} }` on Frankfurter failure. Treating that as success produced bad/empty insights; better to fall back and retry live next time. |

```ts
// NOW (inside map)
if (!res?.rates || Object.keys(res.rates).length === 0) {
  throw new Error('Empty FX history from API');
}
const result = this.transformResponse(res, target);
this.cache.set(cacheKey, result, countryId); // only real history
return result;
```

---

**Change D — Mark demo series as fallback** (`buildDeterministicInsight` return, ~line 262)

| | |
|--|--|
| **Original** | `return this.calculateInsight(rates);` — no flag; looked like normal data when cached in B. |
| **Now** | `return { ...this.calculateInsight(rates), isFallback: true } as …` |
| **Why** | Lets Change B know “this is demo — do not `cache.set`”. |

---

**What teammates should do after pull**
1. Keep uvicorn on `:8000`.
2. Clear Local Storage for `localhost:8100` (or delete `nets_fx_*` / `nets_fx_history_*` keys) once.
3. Hard refresh → Travel FAB / Home MYR should track live ~**3.15**, not stuck ~**3.47**.

---

#### Appendix — original `fx-tracker.service.ts` (before Jun Jie edits)

Source: last committed version (`git show HEAD:src/app/pages/travel/fx-tracker/fx-tracker.service.ts`). Compare with the current working file after pull.

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import { DestinationConfig } from '../services/destination.config';
import { CacheService } from '../services/cache.service';
import { FxRate, FxInsight } from '../fx-tracker/fx-tracker.model';

interface FxHistoryResponse {
  base: string;
  rates: Record<string, Record<string, number>>;
}

interface FxSentimentResponse {
  score: number;
  articleCount: number;
  headlines: string[];
  error?: string;
}

export interface NewsSentiment {
  score: number;
  articleCount: number;
  headlines: string[];
}

export interface FxPrediction {
  forecastRates: FxRate[];
  confidenceUpper: number[];
  confidenceLower: number[];
  sentiment: NewsSentiment;
  technicalSignal: 'bullish' | 'bearish' | 'neutral';
  narrative: string;
}

export interface FxInsightWithPrediction extends FxInsight {
  prediction: FxPrediction;
}

@Injectable({ providedIn: 'root' })
export class FxTrackerService {
  private readonly API_BASE = 'http://localhost:8000/api';

  // Demo fallback rates (expandable)
  private readonly DEMO_RATES: Record<string, number> = {
    'SGD-MYR': 3.48,
    'MYR-SGD': 0.287,
    'SGD-THB': 25.4,
    'THB-SGD': 0.039,
    'SGD-JPY': 112.5,
    'JPY-SGD': 0.0089,
    'SGD-KRW': 985.0,
    'KRW-SGD': 0.0010,
    'SGD-AUD': 1.12,
    'AUD-SGD': 0.89,
  };

  constructor(
    private http: HttpClient,
    private cache: CacheService
  ) {}

  getFxInsightWithPrediction(
    destination: DestinationConfig,
    days: number = 30
  ): Observable<FxInsightWithPrediction> {
    const [base, target] = destination.fxPair;
    const cacheKey = this.cache.key('fx', destination.id);

    const cached = this.cache.get<FxInsightWithPrediction>(cacheKey);
    if (cached) return of(cached);

    return forkJoin({
      history: this.fetchFxHistory(days, base, target, destination.id),
      sentiment: this.fetchNewsSentiment(destination),
    }).pipe(
      map(({ history, sentiment }) => {
        const prediction = this.generatePrediction(history.rates, sentiment, base, target);
        const result: FxInsightWithPrediction = { ...history, prediction };
        this.cache.set(cacheKey, result, destination.id);
        return result;
      }),
      catchError(() => of(this.buildFallbackInsight(days, base, target, destination.id)))
    );
  }

  /** Backward compatibility for travel.page.ts */
  getFxInsight(days: number = 30, destination: DestinationConfig): Observable<FxInsight> {
    return this.fetchFxHistory(days, destination.fxPair[0], destination.fxPair[1], destination.id);
  }

  private fetchFxHistory(days: number, base: string, target: string, countryId: string): Observable<FxInsight> {
    const cacheKey = this.cache.key('fx_history', countryId);
    const cached = this.cache.get<FxInsight>(cacheKey);
    if (cached) return of(cached);

    return this.http
      .post<FxHistoryResponse>(`${this.API_BASE}/fx/history`, { days, base, target })
      .pipe(
        map(res => {
          const result = this.transformResponse(res, target);
          this.cache.set(cacheKey, result, countryId);
          return result;
        }),
        catchError(() => of(this.buildDeterministicInsight(days, base, target)))
      );
  }

private fetchNewsSentiment(destination: DestinationConfig): Observable<NewsSentiment> {
  const cacheKey = this.cache.key('news', destination.id);
  const cached = this.cache.get<NewsSentiment>(cacheKey);
  if (cached) {
    console.log('[FX] Using cached sentiment for', destination.id);
    return of(cached);
  }

  const [base, target] = destination.fxPair;
  
  console.log('[FX] Fetching news sentiment for:', base, 'â†’', target);
  console.log('[FX] Destination newsQuery:', destination.newsQuery);

  return this.http
    .post<FxSentimentResponse>(`${this.API_BASE}/fx/news-sentiment`, { base, target })
    .pipe(
      map(res => {
        console.log('[FX] News API response:', res);
        const result: NewsSentiment = {
          score: res.score ?? 0,
          articleCount: res.articleCount ?? 0,
          headlines: res.headlines ?? [],
        };
        this.cache.set(cacheKey, result, destination.id);
        return result;
      }),
      catchError(err => {
        console.error('[FX] News API FAILED:', err.status, err.message, err.error);
        return of({ score: 0, articleCount: 0, headlines: [] });
      })
    );
}

  private transformResponse(data: FxHistoryResponse, target: string): FxInsight {
    const rates: FxRate[] = Object.entries(data.rates)
      .map(([date, rateObj]) => ({ date, rate: rateObj[target] }))
      .filter(r => r.rate != null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return this.calculateInsight(rates);
  }

  private generatePrediction(rates: FxRate[], sentiment: NewsSentiment, base: string, target: string): FxPrediction {
    const values = rates.map(r => r.rate);
    const n = values.length;
    const ma7 = this.movingAverage(values, 7);
    const ma30 = this.movingAverage(values, 30);
    const current = values[n - 1];
    const volatility = this.standardDeviation(values.slice(-14));
    const maDiff = ma7 - ma30;
    const isSgdBase = base === 'SGD';
    const sentimentImpact = isSgdBase ? -sentiment.score : sentiment.score;
    const dailyDrift = (maDiff / 30 * 0.6) + (sentimentImpact * volatility * 0.4);

    const forecastRates: FxRate[] = [];
    const confidenceUpper: number[] = [];
    const confidenceLower: number[] = [];
    const lastDate = new Date(rates[rates.length - 1].date);
    let predicted = current;

    for (let i = 1; i <= 7; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      const meanReversion = (ma30 - predicted) * 0.05;
      const noise = (Math.random() - 0.5) * volatility * 0.5;
      predicted = predicted + dailyDrift + meanReversion + noise;

      forecastRates.push({ date: this.formatDate(d), rate: parseFloat(predicted.toFixed(4)) });
      const band = volatility * Math.sqrt(i) * 1.5;
      confidenceUpper.push(parseFloat((predicted + band).toFixed(4)));
      confidenceLower.push(parseFloat((predicted - band).toFixed(4)));
    }

    const finalPredicted = forecastRates[forecastRates.length - 1].rate;
    const changePct = ((finalPredicted - current) / current) * 100;
    let technicalSignal: FxPrediction['technicalSignal'];
    if (changePct > 0.3) technicalSignal = isSgdBase ? 'bearish' : 'bullish';
    else if (changePct < -0.3) technicalSignal = isSgdBase ? 'bullish' : 'bearish';
    else technicalSignal = 'neutral';

    const narrative = this.generateNarrative(current, finalPredicted, ma7, ma30, volatility, sentiment, technicalSignal, base, target);

    return { forecastRates, confidenceUpper, confidenceLower, sentiment, technicalSignal, narrative };
  }

  private generateNarrative(current: number, predicted: number, ma7: number, ma30: number, volatility: number, sentiment: NewsSentiment, signal: FxPrediction['technicalSignal'], base: string, target: string): string {
    const changePct = ((predicted - current) / current) * 100;
    const direction = changePct > 0 ? 'rise' : 'fall';
    const absPct = Math.abs(changePct).toFixed(2);

    let techText = '';
    if (ma7 > ma30 * 1.002) techText = `The 7-day MA (${ma7.toFixed(4)}) is above the 30-day (${ma30.toFixed(4)}), signaling upward momentum.`;
    else if (ma7 < ma30 * 0.998) techText = `The 7-day MA (${ma7.toFixed(4)}) is below the 30-day (${ma30.toFixed(4)}), signaling downward pressure.`;
    else techText = `The 7-day and 30-day MAs are aligned, indicating consolidation.`;

    let sentimentText = '';
    if (sentiment.articleCount > 0) {
      const label = sentiment.score > 0.3 ? 'positive' : sentiment.score < -0.3 ? 'negative' : 'mixed';
      sentimentText = `News sentiment from ${sentiment.articleCount} articles is ${label} (score: ${sentiment.score}).`;
    } else {
      sentimentText = `No recent news data available for sentiment analysis.`;
    }

    const volPct = (volatility / current) * 100;
    const volText = volPct > 1.5 ? `High volatility (${volPct.toFixed(1)}%) suggests larger swings.` : `Low volatility (${volPct.toFixed(1)}%) suggests stable trading.`;

    return `Forecast: ${base} to ${direction} against ${target} by ~${absPct}% over 7 days. ${techText} ${sentimentText} ${volText}`;
  }

  private movingAverage(values: number[], period: number): number {
    if (values.length < period) return values.reduce((a, b) => a + b, 0) / values.length;
    return values.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0.01;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
  }

  private buildFallbackInsight(days: number, base: string, target: string, countryId: string): FxInsightWithPrediction {
    const history = this.buildDeterministicInsight(days, base, target);
    const sentiment: NewsSentiment = { score: 0, articleCount: 0, headlines: [] };
    const prediction = this.generatePrediction(history.rates, sentiment, base, target);
    return { ...history, prediction };
  }

  private buildDeterministicInsight(days: number, base: string, target: string): FxInsight {
    const rateKey = `${base}-${target}`;
    const baseRate = this.DEMO_RATES[rateKey] || 1.0;
    const isReversed = base !== 'SGD';
    const min = isReversed ? baseRate * 0.8 : baseRate * 0.7;
    const max = isReversed ? baseRate * 1.2 : baseRate * 1.3;

    const rates: FxRate[] = [];
    const now = new Date();
    let current = baseRate;

    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const change = (this.seededRandom(dateStr + base + target) - 0.5) * 0.003;
      current = current * (1 + change);
      current = Math.max(min, Math.min(max, current));
      rates.push({ date: dateStr, rate: parseFloat(current.toFixed(4)) });
    }
    return this.calculateInsight(rates);
  }

  private calculateInsight(rates: FxRate[]): FxInsight {
    if (rates.length === 0) throw new Error('No FX data');
    const currentRate = rates[rates.length - 1].rate;
    const previousRate = rates.length > 1 ? rates[rates.length - 2].rate : currentRate;
    const changePercent = ((currentRate - previousRate) / previousRate) * 100;
    const allRates = rates.map(r => r.rate);
    return {
      currentRate,
      previousRate,
      changePercent,
      trend: changePercent > 0.05 ? 'up' : changePercent < -0.05 ? 'down' : 'flat',
      high30d: Math.max(...allRates),
      low30d: Math.min(...allRates),
      average30d: allRates.reduce((a, b) => a + b, 0) / allRates.length,
      rates,
    };
  }

  private seededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    const x = Math.sin(hash * 9999) * 10000;
    return x - Math.floor(x);
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}
```

---

### Pay / cards

| File | What changed |
|------|----------------|
| `src/app/pages/pay/pay/pay.page.ts` | Payable-card resolution where needed |
| `src/app/pages/pay/pay/pay.page.html` | Top-up button spinner + “Processing…” |
| `src/app/pages/pay/pay/pay.page.scss` | Spinner styles |
| `src/app/services/cards.service.ts` | `isPayableCard` / `resolveActivePayCard` helpers |
| `src/app/utils/card-display.ts` | Display helpers (card face stays SGD) |

### QR (Home)

| File | What changed |
|------|----------------|
| `src/app/pages/home/home-qr-code/home-qr-code.page.ts` | Pay/Transfer success auto-clears after **3s** → scan UI; timer cleared on leave |
| `src/app/pages/home/home-qr-code/home-qr-code.page.html` | Success / scan UI wiring |
| `src/app/pages/home/home-qr-code/home-qr-code.page.scss` | Related styles |

### Insights page (UI only)

| File | What changed |
|------|----------------|
| `src/app/pages/home/home-ai-insights/home-ai-insights.page.scss` | Hide scrollbar on Insights `ion-content` (Gemini AI coach was tried then **reverted** — not in this build) |

### Login / Signup / shared input helpers

| File | What changed |
|------|----------------|
| `src/app/utils/input-validation.ts` | Added `applySanitizedNativeInput` (digits-only fields must update the DOM, not only the model) |
| `src/app/login-signup/login/login.page.ts` | Phone + PIN: sanitize + write back so letters don’t stick on screen |
| `src/app/login-signup/signup/signup.page.ts` | Same for phone / PIN / confirm PIN (and related sanitizers) |

### Backend (Node :3000)

| File | What changed |
|------|----------------|
| `backend/routes/api.js` | Linked-card **top-up** also inserts **Wallet Top Up** debit on the funding debit/credit card |

### Docs (this note)

| File | What changed |
|------|----------------|
| `14 Jul_MY_UPDATES.md` | This teammate guide |

### Do **not** treat as source / do not commit

| Path | Why |
|------|-----|
| `src/app/security stuffs hehe/__pycache__/*.pyc` | Auto Python cache — ignore |
| `src/app/security stuffs hehe/.env` | Eron’s API keys — local only |
| `backend/.env` | Local secrets if any — do not commit |

### Quick “who owns what”

| Area | Owner |
|------|--------|
| Home currencies UI, Pay, Top-up, QR, login input fix | **Jun Jie** |
| `DESTINATIONS`, Frankfurter / `main.py`, Travel weather & FX FAB data | **Eron** |
| Shared `FxTrackerService` cache behaviour | Touched by Jun Jie for the stale-rate bug — tell Eron if merging Travel |

---

## 2. Backend — Top-up now appears on debit/credit cards

### Problem
Topping up prepaid/CashCard from a linked debit/credit card **debited the bank card balance** but only logged a **credit** on the wallet. OTHERS (debit/credit) history never showed the spend.

### Fix
When funding from a linked bank card, API now also creates a **debit** transaction on the **source** card:

- Wallet (prepaid/CashCard): `NETS Top Up` (credit)
- Debit/credit source: `Wallet Top Up` (debit), subtitle e.g. `To Prepaid · ****xxxx`

### Files
| File | Change |
|------|--------|
| `backend/routes/api.js` | Dual transaction on linked-card top-up |

### Important
- **Restart Node backend** (`npm start` / `npm run backend`) after pull  
- **Only new top-ups** get the source debit row; old ones are not backfilled  

---

## 3. Top-up — processing spinner

### What
Top-up confirm button shows spinner + “Processing…” while the request runs (same pattern as Transfer).

### Files
| File | Change |
|------|--------|
| `src/app/pages/home/home/home.page.html` | Spinner on submit |
| `src/app/pages/home/home/home.page.scss` | Spinner styles |
| `src/app/pages/pay/pay/pay.page.html` | Same on Pay top-up modal |
| `src/app/pages/pay/pay/pay.page.scss` | Spinner styles |

---

## 4. QR page — success message auto-resets after 3s

### What
After Pay / Transfer success on Home QR (`Paid $…` / `Transferred $…`), the green success card stays briefly, then auto-returns to the scan UI (Take Photo / Gallery) after **3 seconds**. **Scan another** still works immediately.

### Files
| File | Change |
|------|--------|
| `src/app/pages/home/home-qr-code/home-qr-code.page.ts` | 3s timer → `scanAnother()`; cleared on leave/destroy |
| `src/app/pages/home/home-qr-code/home-qr-code.page.html` | Related UI wiring (if present in your branch) |
| `src/app/pages/home/home-qr-code/home-qr-code.page.scss` | Related styles |

---

## 5. Pay / card selection helpers (related)

### What
Safer resolution of which card to pay with (skip CashCard when not payable, avoid empty/wrong UI after adding cards).

### Files
| File | Change |
|------|--------|
| `src/app/services/cards.service.ts` | `isPayableCard` / `resolveActivePayCard` helpers |
| `src/app/pages/pay/pay/pay.page.ts` | Uses payable-card resolution where needed |

---

## How to test quickly

1. **Currency list:** Home → Add currency → see converted row → remove with × → refresh page (list should remain).  
2. **Top-up on bank card:** Restart backend → top up prepaid from a debit/credit card → switch to **OTHERS** → that bank card’s “Recent” should show **Wallet Top Up**.  
3. **Top-up spinner:** Open Top Up → confirm → spinner while waiting.  
4. **QR success:** Complete a QR pay or transfer → wait ~3s → UI returns to scan actions.

---

## Do not commit

- `__pycache__/` / `.pyc` files  
- Personal `.env` (FX / Places keys)  

---

## Note: `__pycache__` under `security stuffs hehe` (for Eron / anyone running the FX API)

You may see both of these next to Eron’s Python API folder:

- `src/app/security stuffs hehe/__pycache__/main.cpython-313.pyc`
- `src/app/security stuffs hehe/__pycache__/main.cpython-312.pyc` (was there now 12 Jul)

**Neither is the real source code.** The only file that matters is:

- `src/app/security stuffs hehe/main.py`

### Why these `.pyc` files exist
When someone runs / imports `main.py`, Python auto-creates bytecode caches in `__pycache__` so the next start is faster. The number in the filename is the **Python version** used:

| File | Created by |
|------|------------|
| `main.cpython-313.pyc` | Running with **Python 3.13** (likely already on the machine / earlier runs) |
| `main.cpython-312.pyc` | Running with **Python 3.12** (e.g. `py -3.12` or another install while testing FX / uvicorn locally) |

So `312` is **not** a second copy of the app logic — it appeared because `main.py` was also executed under Python 3.12. Having both is normal if different Python versions were used on the same folder.

### What teammates should do
- Edit / review **`main.py` only**
- Ignore or delete `__pycache__` anytime (Python regenerates it)
- **Do not commit** `__pycache__` or either `.pyc` file

---

## Questions

- Travel / FX API / destinations → **Eron**  
- Home card UI, Pay, Top-up, QR receipt/pay → **Jun Jie**
