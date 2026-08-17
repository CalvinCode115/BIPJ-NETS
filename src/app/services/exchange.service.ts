import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Wallet {
  cardId: string;
  balances: Record<string, number>;
  currencies: string[];
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
export class ExchangeService {
  private apiUrl = environment.pyApiUrl;

  constructor(private http: HttpClient) { }

  getWallet(cardId: string): Observable<Wallet> {
    return this.http.get<Wallet>(`${this.apiUrl}/wallet/${cardId}`).pipe(
      catchError(err => {
        console.error('Wallet load failed:', err);
        return of({ cardId, balances: { SGD: 500 }, currencies: ['SGD'] });
      })
    );
  }

  exchange(req: ExchangeRequest): Observable<ExchangeResult> {
    return this.http.post<ExchangeResult>(`${this.apiUrl}/exchange`, req).pipe(
      catchError(err => {
        console.error('Exchange failed:', err);
        return of({
          success: false,
          message: err.error?.detail || 'Exchange failed. Please try again.'
        });
      })
    );
  }

  getHistory(cardId: string, limit: number = 10): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/exchange/history/${cardId}?limit=${limit}`).pipe(
      catchError(err => {
        console.error('History load failed:', err);
        return of([]);
      })
    );
  }

  // In exchange.service.ts
  deduct(req: { cardId: string; currency: string; amount: number }): Observable<ExchangeResult> {
    return this.http.post<ExchangeResult>(`${this.apiUrl}/wallet/deduct`, req).pipe(
      catchError(err => {
        console.error('Deduct failed:', err);
        return of({
          success: false,
          message: err.error?.detail || 'Payment failed. Please try again.'
        });
      })
    );
  }
}