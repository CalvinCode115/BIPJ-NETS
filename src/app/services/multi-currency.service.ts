import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface MultiCurrencyBalance {
  currency: string;
  amount: number;
  flag: string;
}

export interface CardCurrencyWallet {
  cardId: string;
  primaryCurrency: string;  // SGD
  primaryBalance: number;
  currencies: MultiCurrencyBalance[];
}

@Injectable({
  providedIn: 'root'
})
export class MultiCurrencyService {
  private apiUrl = 'http://localhost:8000';
  private _walletCache: Record<string, CardCurrencyWallet> = {};

  // Observable for real-time balance updates
  private balanceSubject = new BehaviorSubject<Record<string, CardCurrencyWallet>>({});
  public balance$ = this.balanceSubject.asObservable();

  constructor(private http: HttpClient) {}

  getCardWallet(cardId: string): Observable<CardCurrencyWallet> {
    if (this._walletCache[cardId]) {
      return of(this._walletCache[cardId]);
    }

    return this.http.get<any>(`${this.apiUrl}/api/wallet/${cardId}`).pipe(
      map(response => this.transformWallet(response, cardId)),
      catchError(() => {
        // Return default SGD-only wallet if API fails
        const defaultWallet: CardCurrencyWallet = {
          cardId,
          primaryCurrency: 'SGD',
          primaryBalance: 500,
          currencies: []
        };
        return of(defaultWallet);
      })
    );
  }

  refreshWallet(cardId: string): Observable<CardCurrencyWallet> {
    return this.http.get<any>(`${this.apiUrl}/api/wallet/${cardId}`).pipe(
      map(response => {
        const wallet = this.transformWallet(response, cardId);
        this._walletCache[cardId] = wallet;
        this.balanceSubject.next({ ...this._walletCache });
        return wallet;
      }),
      catchError(() => of(this._walletCache[cardId] || {
        cardId,
        primaryCurrency: 'SGD',
        primaryBalance: 500,
        currencies: []
      }))
    );
  }

  getAllCurrenciesForCard(cardId: string): MultiCurrencyBalance[] {
    const wallet = this._walletCache[cardId];
    if (!wallet) return [];

    const result: MultiCurrencyBalance[] = [{
      currency: wallet.primaryCurrency,
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

  getCurrencyFlag(currency: string): string {
    const flags: Record<string, string> = {
      SGD: '🇸🇬', MYR: '🇲🇾', THB: '🇹🇭', JPY: '🇯🇵', KRW: '🇰🇷',
      AUD: '🇦🇺', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', CNY: '🇨🇳',
      HKD: '🇭🇰', CAD: '🇨🇦', CHF: '🇨🇭', INR: '🇮🇳', IDR: '🇮🇩',
      PHP: '🇵🇭', VND: '🇻🇳', NZD: '🇳🇿'
    };
    return flags[currency] || '💱';
  }

  formatAmount(amount: number, currency: string): string {
    const noDecimal = currency === 'JPY' || currency === 'KRW' || currency === 'IDR' || currency === 'VND';
    if (noDecimal) {
      return `${this.getCurrencySymbol(currency)}${Math.round(amount).toLocaleString('en-SG')}`;
    }
    return `${this.getCurrencySymbol(currency)}${amount.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  private transformWallet(response: any, cardId: string): CardCurrencyWallet {
    const balances: Record<string, number> = response.balances || { SGD: 500 };
    const currencies: string[] = response.currencies || ['SGD'];

    const primaryBalance = balances['SGD'] || balances[Object.keys(balances)[0]] || 0;

    const foreignCurrencies: MultiCurrencyBalance[] = [];
    for (const curr of currencies) {
      if (curr !== 'SGD' && balances[curr] > 0.01) {
        foreignCurrencies.push({
          currency: curr,
          amount: balances[curr],
          flag: this.getCurrencyFlag(curr)
        });
      }
    }

    return {
      cardId,
      primaryCurrency: 'SGD',
      primaryBalance,
      currencies: foreignCurrencies
    };
  }
}