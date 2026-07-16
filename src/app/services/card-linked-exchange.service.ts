import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { CardsService } from './cards.service';

export interface CardCurrencyBalance {
  currency: string;
  amount: number;
  flag: string;
}

export interface CardMultiCurrencyWallet {
  cardId: string;
  primaryCurrency: string;
  primaryBalance: number;
  currencies: CardCurrencyBalance[];
}

export interface ExchangeRequest {
  cardId: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

export interface ExchangeResult {
  success: boolean;
  message: string;
  newBalances?: Record<string, number>;
  transaction?: any;
}

@Injectable({
  providedIn: 'root'
})
export class CardLinkedExchangeService {
  private _wallets: Record<string, CardMultiCurrencyWallet> = {};
  private walletSubject = new BehaviorSubject<Record<string, CardMultiCurrencyWallet>>({});
  public wallet$ = this.walletSubject.asObservable();

  // Fallback exchange rates
  private readonly rates: Record<string, Record<string, number>> = {
    SGD: {
      MYR: 3.45, THB: 26.2, JPY: 112.5, KRW: 985,
      USD: 0.74, EUR: 0.68, GBP: 0.58, AUD: 1.12,
      CAD: 1.01, CHF: 0.66, CNY: 5.35, HKD: 5.78,
      INR: 61.5, IDR: 11500, PHP: 42.5, VND: 18500, NZD: 1.22
    }
  };

  constructor(
    private http: HttpClient,
    private cardsService: CardsService
  ) {
    this.loadFromStorage();
  }

getAllCurrencies(cardId: string, currentSgdBalance: number): Observable<CardCurrencyBalance[]> {
  // Don't call getWallet() which might overwrite — build result directly
  const localWallet = this._wallets[cardId];
  
  const result: CardCurrencyBalance[] = [{
    currency: 'SGD',
    amount: currentSgdBalance,  // ← Use the REAL Firestore value, not cached
    flag: '🇸🇬'
  }];

  if (localWallet) {
    for (const curr of localWallet.currencies) {
      if (curr.currency !== 'SGD' && curr.amount > 0.01) {
        result.push({
          currency: curr.currency,
          amount: curr.amount,
          flag: this.getCurrencyFlag(curr.currency)
        });
      }
    }
  }

  return of(result);
}

  /** Exchange — HITS BACKEND */
  exchange(req: ExchangeRequest, _currentSgdBalance: number): Observable<ExchangeResult> {
    const userId = localStorage.getItem('nets_user_id') || 'user_1';
    const rate = this.getMockRate(req.fromCurrency, req.toCurrency);
    
    return this.cardsService.exchangeCurrency(userId, req.cardId, {
      fromCurrency: req.fromCurrency,
      toCurrency: req.toCurrency,
      amount: req.amount,
      rate: rate
    }).pipe(
      tap((result) => {
        if (result.success) {
          this.cacheWallet(req.cardId, result.newBalances);
        }
      }),
      catchError(() => of(this.localExchange(req, _currentSgdBalance)))
    );
  }

  /** Deduct — HITS BACKEND */
  deductFromCurrency(cardId: string, currency: string, amount: number, _currentSgdBalance: number): Observable<ExchangeResult> {
    const userId = localStorage.getItem('nets_user_id') || 'user_1';
    
    return this.cardsService.deductCurrency(userId, cardId, {
      currency,
      amount
    }).pipe(
      tap((result) => {
        if (result.success) {
          this.cacheWallet(cardId, result.newBalances);
        }
      }),
      catchError(() => of(this.localDeduct(cardId, currency, amount, _currentSgdBalance)))
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // LOCAL FALLBACK METHODS (for offline)
  // ═════════════════════════════════════════════════════════════════

  private getLocalWallet(cardId: string, currentSgdBalance: number): CardMultiCurrencyWallet {
    if (!this._wallets[cardId]) {
      this._wallets[cardId] = {
        cardId,
        primaryCurrency: 'SGD',
        primaryBalance: currentSgdBalance,
        currencies: []
      };
    }
    return this._wallets[cardId];
  }

  private cacheWallet(cardId: string, balances: Record<string, number>): void {
    const currencies: CardCurrencyBalance[] = [];
    for (const [currency, amount] of Object.entries(balances)) {
      if (currency !== 'SGD' && amount > 0.01) {
        currencies.push({ currency, amount, flag: this.getCurrencyFlag(currency) });
      }
    }
    
    this._wallets[cardId] = {
      cardId,
      primaryCurrency: 'SGD',
      primaryBalance: balances['SGD'] || 0,
      currencies
    };
    
    this.saveToStorage();
  }

  private localExchange(req: ExchangeRequest, currentSgdBalance: number): ExchangeResult {
    const rate = this.getMockRate(req.fromCurrency, req.toCurrency);
    const fee = req.amount * 0.005;
    const converted = (req.amount - fee) * rate;

    if (req.fromCurrency === 'SGD' && currentSgdBalance < req.amount) {
      return {
        success: false,
        message: `Insufficient SGD balance. You have S$${currentSgdBalance.toFixed(2)} but need S$${req.amount.toFixed(2)}.`,
      };
    }

    const wallet = this.getLocalWallet(req.cardId, currentSgdBalance);
    const newSgdBalance = req.fromCurrency === 'SGD'
      ? currentSgdBalance - req.amount
      : currentSgdBalance;

    wallet.primaryBalance = newSgdBalance;
    
    const existing = wallet.currencies.find(c => c.currency === req.toCurrency);
    if (existing) {
      existing.amount += converted;
    } else {
      wallet.currencies.push({ 
        currency: req.toCurrency, 
        amount: converted,
        flag: this.getCurrencyFlag(req.toCurrency)
      });
    }

    this._wallets[req.cardId] = wallet;
    this.saveToStorage();

    return {
      success: true,
      message: `Exchanged ${req.fromCurrency} ${req.amount.toFixed(2)} to ${req.toCurrency} ${converted.toFixed(2)}`,
      newBalances: {
        SGD: newSgdBalance,
        [req.toCurrency]: existing ? existing.amount : converted,
      },
    };
  }

  private localDeduct(cardId: string, currency: string, amount: number, currentSgdBalance: number): ExchangeResult {
    const wallet = this.getLocalWallet(cardId, currentSgdBalance);

    if (currency === 'SGD') {
      if (wallet.primaryBalance < amount) {
        return {
          success: false,
          message: `Insufficient SGD balance. Available: $${wallet.primaryBalance.toFixed(2)}`
        };
      }
      wallet.primaryBalance -= amount;
    } else {
      const foreignCurr = wallet.currencies.find(c => c.currency === currency);
      if (!foreignCurr) {
        return {
          success: false,
          message: `No ${currency} balance found.`
        };
      }
      if (foreignCurr.amount < amount) {
        return {
          success: false,
          message: `Insufficient ${currency} balance.`
        };
      }
      foreignCurr.amount -= amount;
      if (foreignCurr.amount < 0.01) {
        wallet.currencies = wallet.currencies.filter(c => c.currency !== currency);
      }
    }

    this._wallets[cardId] = wallet;
    this.saveToStorage();

    return {
      success: true,
      message: `Paid ${this.getCurrencySymbol(currency)}${amount.toFixed(2)} ${currency}`,
      newBalances: {
        SGD: wallet.primaryBalance,
        ...wallet.currencies.reduce((acc, c) => ({ ...acc, [c.currency]: c.amount }), {})
      }
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═════════════════════════════════════════════════════════════════

  private getMockRate(from: string, to: string): number {
    if (from === to) return 1;
    const fromRates = this.rates[from];
    if (fromRates && fromRates[to]) return fromRates[to];
    const toRates = this.rates[to];
    if (toRates && toRates[from]) return 1 / toRates[from];
    return 1;
  }

  formatAmount(amount: number, currency: string): string {
    const noDecimal = ['JPY', 'KRW', 'IDR', 'VND'].includes(currency);
    if (noDecimal) {
      return Math.round(amount).toLocaleString('en-SG');
    }
    return amount.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getCurrencyFlag(currency: string): string {
    const flags: Record<string, string> = {
      SGD: '🇸🇬', MYR: '🇲🇾', THB: '🇹🇭', JPY: '🇯🇵', KRW: '🇰🇷',
      AUD: '🇦🇺', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CNY: '🇨🇳',
      HKD: '🇭🇰', CAD: '🇨🇦', CHF: '🇨🇭', INR: '🇮🇳', IDR: '🇮🇩',
      PHP: '🇵🇭', VND: '🇻🇳', NZD: '🇳🇿'
    };
    return flags[currency] || '💱';
  }

  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      SGD: '$', MYR: 'RM ', THB: '฿', JPY: '¥', KRW: '₩',
      AUD: 'A$', USD: '$', EUR: '€', GBP: '£', CNY: '¥',
      HKD: 'HK$', CAD: 'C$', CHF: 'CHF ', INR: '₹', IDR: 'Rp ',
      PHP: '₱', VND: '₫', NZD: 'NZ$'
    };
    return symbols[currency] || currency + ' ';
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem('nets_exchange_wallets');
      if (raw) {
        this._wallets = JSON.parse(raw);
      }
    } catch {
      this._wallets = {};
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('nets_exchange_wallets', JSON.stringify(this._wallets));
    } catch {
      // Ignore storage errors
    }
  }
}