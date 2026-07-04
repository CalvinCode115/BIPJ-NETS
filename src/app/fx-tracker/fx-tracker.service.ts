import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { FxRate, FxInsight } from './fx-tracker.model';

@Injectable({
  providedIn: 'root'
})
export class FxTrackerService {
  // Demo fallback rate (realistic SGD→MYR as of mid-2026)
  private readonly DEMO_RATE = 3.4800;

  constructor(private http: HttpClient) {}

  // Get current rate — tries API, falls back to demo immediately
  getCurrentRate(): Observable<number> {
    // For school demo, skip API calls entirely to avoid CORS issues
    // In production, uncomment the API call below
    return of(this.DEMO_RATE);

    /* PRODUCTION VERSION:
    return this.http.get<any>('https://open.er-api.com/v6/latest/SGD').pipe(
      map(res => {
        const rate = res?.rates?.MYR ?? res?.conversion_rates?.MYR;
        if (typeof rate === 'number' && !isNaN(rate)) return rate;
        throw new Error('Invalid rate');
      }),
      catchError(() => {
        console.warn('[FX] API failed, using demo rate:', this.DEMO_RATE);
        return of(this.DEMO_RATE);
      })
    );
    */
  }

  // Get full insight + historical rates
  getFxInsight(days: number = 30): Observable<FxInsight> {
    return this.getCurrentRate().pipe(
      map(currentRate => {
        const rates = this.generateMockRates(currentRate, days);
        return this.calculateInsight(rates);
      })
    );
  }

  // Get historical rates (for chart refresh)
  getHistoricalRates(days: number = 30): Observable<FxRate[]> {
    return this.getCurrentRate().pipe(
      map(rate => this.generateMockRates(rate, days))
    );
  }

  // ========== PRIVATE HELPERS ==========

  private generateMockRates(baseRate: number, days: number): FxRate[] {
    const rates: FxRate[] = [];
    const now = new Date();
    // Seed with a deterministic starting point so chart looks realistic
    let current = baseRate * (1 + (Math.random() * 0.03 - 0.015));

    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      // Small daily random walk: ±0.15% per day
      const change = (Math.random() - 0.5) * 0.003;
      current = current * (1 + change);
      // Keep within realistic bounds for SGD/MYR (3.2 - 3.7)
      current = Math.max(3.2, Math.min(3.7, current));

      rates.push({
        date: d.toISOString().split('T')[0],
        rate: parseFloat(current.toFixed(4))
      });
    }
    return rates;
  }

  private calculateInsight(rates: FxRate[]): FxInsight {
    if (rates.length === 0) {
      throw new Error('No FX data available');
    }

    const currentRate = rates[rates.length - 1].rate;
    const previousRate = rates.length > 1 ? rates[rates.length - 2].rate : currentRate;
    const changePercent = ((currentRate - previousRate) / previousRate) * 100;

    const allRates = rates.map(r => r.rate);
    const high30d = Math.max(...allRates);
    const low30d = Math.min(...allRates);
    const average30d = allRates.reduce((a, b) => a + b, 0) / allRates.length;

    let trend: 'up' | 'down' | 'flat';
    if (changePercent > 0.05) trend = 'up';
    else if (changePercent < -0.05) trend = 'down';
    else trend = 'flat';

    return {
      currentRate,
      previousRate,
      changePercent,
      trend,
      high30d,
      low30d,
      average30d,
      rates
    };
  }
}