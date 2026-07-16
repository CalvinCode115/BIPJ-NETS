  import { Injectable } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { Observable, of, BehaviorSubject } from 'rxjs';
  import { catchError, map } from 'rxjs/operators';

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
    private apiUrl = 'http://localhost:8000';
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

    constructor(private http: HttpClient) {
      this.loadFromStorage();
    }

    /** Get or create wallet for a card */
    getWallet(cardId: string, currentSgdBalance: number = 500): CardMultiCurrencyWallet {
      if (!this._wallets[cardId]) {
        this._wallets[cardId] = {
          cardId,
          primaryCurrency: 'SGD',
          primaryBalance: currentSgdBalance,
          currencies: []
        };
        this.saveToStorage();
      } else {
        // Sync primary balance with current card balance
        this._wallets[cardId].primaryBalance = currentSgdBalance;
      }
      return this._wallets[cardId];
    }

    /** Perform exchange: deduct from card's SGD, add foreign currency */
    exchange(req: ExchangeRequest, currentSgdBalance: number): ExchangeResult {
      const wallet = this.getWallet(req.cardId, currentSgdBalance);

      // Validate
      if (req.fromCurrency !== 'SGD') {
        return { success: false, message: 'Only SGD to foreign currency exchanges are supported.' };
      }

      if (req.amount <= 0) {
        return { success: false, message: 'Enter a positive amount.' };
      }

      if (wallet.primaryBalance < req.amount) {
        return { 
          success: false, 
          message: `Insufficient SGD balance. Available: $${wallet.primaryBalance.toFixed(2)}` 
        };
      }

      // Get rate
      const rate = this.rates['SGD'][req.toCurrency];
      if (!rate) {
        return { success: false, message: `Exchange rate not available for ${req.toCurrency}.` };
      }

      // Calculate
      const fee = req.amount * 0.005;
      const amountAfterFee = req.amount - fee;
      const received = amountAfterFee * rate;

      // Update wallet
      wallet.primaryBalance -= req.amount;

      const existing = wallet.currencies.find(c => c.currency === req.toCurrency);
      if (existing) {
        existing.amount += received;
      } else {
        wallet.currencies.push({
          currency: req.toCurrency,
          amount: received,
          flag: this.getCurrencyFlag(req.toCurrency)
        });
      }

      this._wallets[req.cardId] = wallet;
      this.saveToStorage();
      this.walletSubject.next({ ...this._wallets });

      return {
        success: true,
        message: `Exchanged $${req.amount.toFixed(2)} SGD → ${this.formatAmount(received, req.toCurrency)} ${req.toCurrency}`,
        newBalances: {
          SGD: wallet.primaryBalance,
          [req.toCurrency]: existing ? existing.amount : received
        },
        transaction: {
          id: `ex_${Date.now()}`,
          cardId: req.cardId,
          fromCurrency: req.fromCurrency,
          toCurrency: req.toCurrency,
          amount: req.amount,
          rate,
          fee,
          received,
          timestamp: new Date().toISOString()
        }
      };
    }

    /** Get all currencies for a card (including SGD) */
    getAllCurrencies(cardId: string, currentSgdBalance: number): CardCurrencyBalance[] {
      const wallet = this.getWallet(cardId, currentSgdBalance);
      const result: CardCurrencyBalance[] = [{
        currency: 'SGD',
        amount: wallet.primaryBalance,
        flag: '🇸🇬'
      }];

      for (const curr of wallet.currencies) {
        if (curr.amount > 0.01) {
          result.push(curr);
        }
      }

      return result;
    }

    /** Get recent exchanges for a card */
    getHistory(cardId: string, limit: number = 10): any[] {
      // In a real app, this would come from backend
      // For now, return empty or stored transactions
      return [];
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

    deductFromCurrency(cardId: string, currency: string, amount: number, currentSgdBalance: number): ExchangeResult {
    const wallet = this.getWallet(cardId, currentSgdBalance);

    if (currency === 'SGD') {
      // Deduct from primary balance
      if (wallet.primaryBalance < amount) {
        return {
          success: false,
          message: `Insufficient SGD balance. Available: $${wallet.primaryBalance.toFixed(2)}`
        };
      }
      wallet.primaryBalance -= amount;
    } else {
      // Deduct from foreign currency
      const foreignCurr = wallet.currencies.find(c => c.currency === currency);
      if (!foreignCurr) {
        return {
          success: false,
          message: `No ${currency} balance found. Exchange SGD to ${currency} first in FX Tracker.`
        };
      }
      if (foreignCurr.amount < amount) {
        return {
          success: false,
          message: `Insufficient ${currency} balance. Available: ${this.getCurrencySymbol(currency)}${foreignCurr.amount.toFixed(2)}, Need: ${this.getCurrencySymbol(currency)}${amount.toFixed(2)}`
        };
      }
      foreignCurr.amount -= amount;
      // Remove if depleted
      if (foreignCurr.amount < 0.01) {
        wallet.currencies = wallet.currencies.filter(c => c.currency !== currency);
      }
    }

    this._wallets[cardId] = wallet;
    this.saveToStorage();
    this.walletSubject.next({ ...this._wallets });

    return {
      success: true,
      message: `Paid ${this.getCurrencySymbol(currency)}${amount.toFixed(2)} ${currency}`,
      newBalances: this.getBalanceRecord(wallet)
    };
  }

  /** Get balance as a simple Record for easy access */
  private getBalanceRecord(wallet: CardMultiCurrencyWallet): Record<string, number> {
    const record: Record<string, number> = { SGD: wallet.primaryBalance };
    for (const c of wallet.currencies) {
      record[c.currency] = c.amount;
    }
    return record;
  }

  /** Get balance of a specific currency */
  getCurrencyBalance(cardId: string, currency: string, currentSgdBalance: number): number {
    const wallet = this.getWallet(cardId, currentSgdBalance);
    if (currency === 'SGD') return wallet.primaryBalance;
    const found = wallet.currencies.find(c => c.currency === currency);
    return found?.amount || 0;
  }
  }