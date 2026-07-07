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
  
  console.log('[FX] Fetching news sentiment for:', base, '→', target);
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