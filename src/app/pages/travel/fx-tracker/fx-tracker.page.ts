import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { FxTrackerService } from './fx-tracker.service';
import { FxInsightWithPrediction } from './fx-tracker.model';
import { DESTINATIONS, DEFAULT_DESTINATION } from '../../../services/destination.config';
import { DestinationConfig } from '../../../services/destination.config';
import { CardLinkedExchangeService, ExchangeRequest } from '../../../services/card-linked-exchange.service';
import { CardsService, MultiCurrencyWallet, ExchangeCurrencyResponse, getCardFundsAmount } from '../../../services/cards.service';
import { catchError, map, Observable, of } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { currentSgdBalanceStorageKey, selectedCardStorageKey } from '../../../utils/card-storage';
Chart.register(...registerables);

@Component({
  selector: 'app-fx-tracker',
  templateUrl: './fx-tracker.page.html',
  styleUrls: ['./fx-tracker.page.scss'],
  standalone: false,
})
export class FxTrackerPage implements OnInit {
  @ViewChild('fxChart') fxChartRef!: ElementRef;

  insight: FxInsightWithPrediction | null = null;
  isLoading = false;
  error: string | null = null;
  isReversed = false;

  // Dynamic destination loaded from localStorage
  currentDestination: DestinationConfig = DESTINATIONS[DEFAULT_DESTINATION];

  // ─── EXCHANGE FEATURE ───
  exchangeAmount = 0;
  exchangePreview = 0;
  exchangeFee = 0;
  isExchanging = false;
  exchangeResult: { success: boolean; message: string; newBalances?: any } | null = null;
  wallet: { cardId: string; balances: Record<string, number>; currencies: string[] } | null = null;
  recentExchanges: any[] = [];

  // Use actual card ID from localStorage or default
  cardId: string = 'default';

  get baseCurrency(): string {
    return this.isReversed ? this.currentDestination.currencyCode : this.currentDestination.homeCurrencyCode;
  }

  get targetCurrency(): string {
    return this.isReversed ? this.currentDestination.homeCurrencyCode : this.currentDestination.currencyCode;
  }

  get destination(): string {
    return this.currentDestination.country;
  }

  get currentRate(): number {
    return this.insight?.currentRate || 0;
  }

  get walletCurrencies(): string[] {
    return this.wallet?.currencies || ['SGD'];
  }

  get availableCurrencies(): string[] {
    const all = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'KRW', 'THB', 'MYR', 'INR', 'IDR', 'PHP', 'VND', 'NZD', 'SGD'];
    return all.filter(c => c !== this.baseCurrency);
  }

  chart: Chart | null = null;

  constructor(
    private fxService: FxTrackerService,
    private exchangeService: CardLinkedExchangeService,
    private location: Location,
    private cardsService: CardsService,
    private auth: AuthService,
  ) { }

  ngOnInit() {
    const userId = this.auth.userId;

    if (!userId) {
      this.error = 'Please log in to use currency exchange.';
      return;
    }

    // Now use userId here (no redeclaration)
    const savedDest = localStorage.getItem(
      `nets_selected_destination_${userId}`,
    );
    if (savedDest) {
      if (DESTINATIONS[savedDest]) {
        this.currentDestination = DESTINATIONS[savedDest];
      } else {
        try {
          const parsed = JSON.parse(savedDest);
          if (parsed && parsed.id) {
            this.currentDestination = {
              ...parsed,
              homeCurrencyCode: parsed.homeCurrencyCode || 'SGD',
              currencyCode: parsed.currencyCode || parsed.fxPair?.[1] || 'USD',
              fxPair: Array.isArray(parsed.fxPair)
                ? parsed.fxPair
                : ['SGD', parsed.currencyCode || 'USD'],
            };
          }
        } catch {
          // Invalid JSON, keep default
        }
      }
    }

    if (!userId) {
      this.error = 'Please log in to use currency exchange.';
      return;
    }

    const savedCardId = localStorage.getItem(
      selectedCardStorageKey(userId)
    );

    if (savedCardId) {
      this.cardId = savedCardId;
    }

    this.syncSgdFromFirestore();

    this.loadFxData();
    this.loadWallet();
  }

  setDirection(reversed: boolean) {
    if (this.isReversed === reversed) return;
    this.isReversed = reversed;
    this.loadFxData();
    this.updateExchangePreview();
  }

  loadFxData() {
    this.isLoading = true;
    this.error = null;
    this.insight = null;
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    this.fxService.getFxInsightWithPrediction(this.currentDestination, 30).subscribe({
      next: (insight) => {
        this.insight = insight;
        this.isLoading = false;
        setTimeout(() => this.renderChart(), 0);
      },
      error: (err) => {
        console.error('FX load failed:', err);
        this.error = err.message || 'Failed to load FX data';
        this.isLoading = false;
      }
    });
  }

  loadWallet() {
    const userId = this.auth.userId;

    if (!userId) {
      this.wallet = null;
      this.error = 'Please log in to view your wallet.';
      return;
    }

    // Get REAL data from Firestore
    this.cardsService.getWallet(userId).subscribe({
      next: (wallet) => {
        const allCards = [...wallet.prepaid, ...wallet.cashcard, ...wallet.others];
        const selectedCard = allCards.find((card) => card.id === this.cardId);
        const exchangeCard = selectedCard ?? wallet.prepaid[0] ?? null;

        if (!exchangeCard) {
          this.isExchanging = false;
          this.exchangeResult = {
            success: false,
            message: 'No valid prepaid card is available for exchange.',
          };
          return;
        }

        this.cardId = exchangeCard.id;
        localStorage.setItem(
          selectedCardStorageKey(userId),
          exchangeCard.id
        );

        const realSgdBalance = getCardFundsAmount(exchangeCard);

        // Sync SGD to localStorage
        localStorage.setItem(
          currentSgdBalanceStorageKey(userId),
          String(realSgdBalance)
        );

        // ─── FIX: Read multi_currency from Firestore, not local service ───
        this.cardsService.getCardWallet(userId, this.cardId).subscribe({
          next: (multiWallet: MultiCurrencyWallet) => {
            this.wallet = {
              cardId: this.cardId,
              balances: multiWallet.balances,
              currencies: multiWallet.currencies
            };
          },
          error: () => {
            // Fallback: just SGD
            this.wallet = {
              cardId: this.cardId,
              balances: { SGD: realSgdBalance },
              currencies: ['SGD']
            };
          }
        });
      },
      error: () => {
        const savedSgd = localStorage.getItem(
          currentSgdBalanceStorageKey(userId)
        );
        const sgdBalance = savedSgd ? parseFloat(savedSgd) : 500;
        this.wallet = {
          cardId: this.cardId,
          balances: { SGD: sgdBalance },
          currencies: ['SGD']
        };
      }
    });
  }

  private currenciesToRecord(currencies: any[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const c of currencies) {
      result[c.currency] = c.amount;
    }
    return result;
  }

  updateExchangePreview() {
    if (this.exchangeAmount <= 0) {
      this.exchangePreview = 0;
      this.exchangeFee = 0;
      return;
    }
    const rate = this.exchangeRate;
    this.exchangeFee = this.exchangeAmount * 0.005;
    const amountAfterFee = this.exchangeAmount - this.exchangeFee;
    this.exchangePreview = amountAfterFee * rate;
  }

  canExchange(): boolean {
    if (!this.wallet || this.exchangeAmount <= 0) return false;
    const balance = this.wallet.balances[this.baseCurrency] || 0;
    return this.exchangeAmount <= balance;
  }

  executeExchange() {
    this.doExchange();
  }

  doExchange() {
    if (!this.canExchange()) return;

    if (this.baseCurrency === this.targetCurrency) {
      this.isExchanging = false;
      this.exchangeResult = {
        success: false,
        message: `Cannot exchange ${this.baseCurrency} to ${this.targetCurrency}. Please select different currencies.`,
      };
      return;
    }
    this.isExchanging = true;
    this.exchangeResult = null;

    const userId = this.auth.userId;

    if (!userId) {
      this.isExchanging = false;
      this.exchangeResult = {
        success: false,
        message: 'Please log in before exchanging currency.',
      };
      return;
    }

    console.log('=== EXCHANGE DEBUG ===');
    console.log('cardId being used:', this.cardId);
    console.log('wallet before exchange:', this.wallet);

    // Get real SGD first
    this.cardsService.getWallet(userId).subscribe({
      next: (wallet) => {
        const allCards = [...wallet.prepaid, ...wallet.cashcard, ...wallet.others];
        const card = allCards.find(c => c.id === this.cardId);

        console.log('Card found in Firestore:', card);
        console.log('Card balance from Firestore:', card?.balance);
        console.log('Card ID from Firestore:', card?.id);

        const realSgdBalance = card?.balance ?? 500;

        const rate = this.exchangeRate || this.getMockRate(this.baseCurrency, this.targetCurrency);
        console.log('=== FRONTEND SENDING ===');
        console.log('exchangeAmount:', this.exchangeAmount, typeof this.exchangeAmount);
        console.log('baseCurrency:', this.baseCurrency);
        console.log('targetCurrency:', this.targetCurrency);
        console.log('rate:', rate);

        this.cardsService.exchangeCurrency(userId, this.cardId, {
          fromCurrency: this.baseCurrency,
          toCurrency: this.targetCurrency,
          amount: this.exchangeAmount,
          rate: rate
        }).subscribe({
          next: (result: ExchangeCurrencyResponse) => {
            this.isExchanging = false;
            this.exchangeResult = {
              success: result.success,
              message: result.message,
              newBalances: result.newBalances
            };

            if (result.success) {
              this.loadWallet();
              window.dispatchEvent(new CustomEvent('nets:exchangeCompleted', {
                detail: { cardId: this.cardId, newBalances: result.newBalances }
              }));
            }

            this.exchangeAmount = 0;
            this.updateExchangePreview();
          },
          error: () => {
            this.isExchanging = false;
            this.exchangeResult = {
              success: false,
              message: 'Exchange failed. Please try again.'
            };
          }
        });
      },
      error: () => {
        this.isExchanging = false;
        this.exchangeResult = {
          success: false,
          message: 'Could not verify balance. Please try again.'
        };
      }
    });
  }
  private getMockRate(from: string, to: string): number {
    const rates: Record<string, Record<string, number>> = {
      SGD: { MYR: 3.45, THB: 26.2, JPY: 112.5, KRW: 985, USD: 0.74, EUR: 0.68, GBP: 0.58, AUD: 1.12 }
    };

    if (from === to) return 1;

    // Forward: SGD → MYR = 3.45
    if (rates[from] && rates[from][to]) return rates[from][to];

    // Reverse: MYR → SGD = 1/3.45
    if (rates[to] && rates[to][from]) return 1 / rates[to][from];

    return 1;
  }

  swapExchangeDirection() {
    this.swapDirection();
  }

  swapDirection() {
    this.isReversed = !this.isReversed;
    this.updateExchangePreview();
  }

  formatBalance(value: number, currency: string): string {
    return (value || 0).toFixed(2);
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

  getWalletCurrencies(): string[] {
    return this.wallet?.currencies || ['SGD'];
  }

  // ─── CHART & UI ───
  private getChartRate(rate: number): number {
    if (this.isReversed && rate > 0) {
      return 1 / rate;
    }
    return rate;
  }


  renderChart() {
    if (!this.fxChartRef || !this.insight) return;
    const ctx = this.fxChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    if (this.chart) this.chart.destroy();

    const hist = this.insight.rates;
    const pred = this.insight.prediction.forecastRates;
    const upper = this.insight.prediction.confidenceUpper;
    const lower = this.insight.prediction.confidenceLower;

    const histLabels = hist.map(r => {
      const d = new Date(r.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const predLabels = pred.map(r => {
      const d = new Date(r.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    const allLabels = [...histLabels, ...predLabels];
    const histData = [...hist.map(r => this.getChartRate(r.rate)), ...new Array(pred.length).fill(null)];
    const predData = [...new Array(hist.length - 1).fill(null), this.getChartRate(hist[hist.length - 1].rate), ...pred.map(r => this.getChartRate(r.rate))];
    const upperData = [...new Array(hist.length).fill(null), ...upper.map(r => this.getChartRate(r))];
    const lowerData = [...new Array(hist.length).fill(null), ...lower.map(r => this.getChartRate(r))];
    const rawTrend = this.insight.trend;
    const displayTrend = this.isReversed
      ? (rawTrend === 'up' ? 'down' : rawTrend === 'down' ? 'up' : 'stable')
      : rawTrend;
    const trendColor = displayTrend === 'up' ? '#d71920' :
      displayTrend === 'down' ? '#34c759' : '#ff9500';
    const predColor = '#8e8e93';

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Confidence',
            data: upperData,
            borderColor: 'transparent',
            backgroundColor: 'rgba(142, 142, 147, 0.1)',
            fill: '+1',
            pointRadius: 0,
            pointHoverRadius: 0,
          },
          {
            label: 'Confidence Lower',
            data: lowerData,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            pointHoverRadius: 0,
          },
          {
            label: `${this.baseCurrency}/${this.targetCurrency} (Historical)`,
            data: histData,
            borderColor: trendColor,
            backgroundColor: this.hexToRgba(trendColor, 0.1),
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointBackgroundColor: trendColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
          {
            label: '7-Day Forecast',
            data: predData,
            borderColor: predColor,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: predColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 11 },
              filter: (item: any) => item.text !== 'Confidence' && item.text !== 'Confidence Lower',
            }
          },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleColor: '#fff',
            bodyColor: '#fff',
            cornerRadius: 8,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.y;
                if (value == null) return '';
                const isPred = context.dataset.label?.includes('Forecast');
                return `${context.dataset.label?.replace(' (Historical)', '')}: ${value.toFixed(4)} ${isPred ? '(forecast)' : ''}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#8e8e93', font: { size: 10 }, maxTicksLimit: 8 }
          },
          y: {
            grid: { color: '#f0f0f0' },
            ticks: { color: '#8e8e93', font: { size: 10 }, callback: (v: any) => Number(v).toFixed(4) }
          }
        }
      }
    });
  }

  refresh() { this.loadFxData(); }
  goBack() { this.location.back(); }

  getTrendIcon(): string {
    if (!this.insight) return 'remove-outline';
    if (this.insight.trend === 'up') return 'trending-up-outline';
    if (this.insight.trend === 'down') return 'trending-down-outline';
    return 'remove-outline';
  }

  getTrendColor(): string {
    if (!this.insight) return '#8e8e93';
    if (this.insight.trend === 'up') return '#d71920';
    if (this.insight.trend === 'down') return '#34c759';
    return '#ff9500';
  }

  getTrendLabel(): string {
    if (!this.insight) return 'Stable';

    const rawTrend = this.insight.trend;
    const trend = this.isReversed
      ? (rawTrend === 'up' ? 'down' : rawTrend === 'down' ? 'up' : 'stable')
      : rawTrend;

    if (trend === 'up') return `${this.baseCurrency} Weakening`;
    if (trend === 'down') return `${this.baseCurrency} Strengthening`;
    return 'Stable';
  }

  getSignalColor(): string {
    if (!this.insight) return '#8e8e93';
    const s = this.insight.prediction.technicalSignal;
    if (s === 'bullish') return '#34c759';
    if (s === 'bearish') return '#d71920';
    return '#ff9500';
  }

  getSignalIcon(): string {
    if (!this.insight) return 'remove-outline';
    const s = this.insight.prediction.technicalSignal;
    if (s === 'bullish') return 'trending-up-outline';
    if (s === 'bearish') return 'trending-down-outline';
    return 'remove-outline';
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  get exchangeRate(): number {
    const rate = this.insight?.currentRate || 0;
    if (this.isReversed && rate > 0) {
      return 1 / rate;  // MYR → SGD: 1 / 3.14 = 0.318
    }
    return rate;  // SGD → MYR: 3.14
  }

  private syncSgdFromFirestore(): void {
    const userId = this.auth.userId;

    if (!userId) {
      return;
    }

    const key = currentSgdBalanceStorageKey(userId);
    const saved = localStorage.getItem(key);

    if (!saved) {
      localStorage.setItem(key, '500');
    }
  }

  private getCurrentSgdBalance(): Observable<number> {
    const userId = this.auth.userId;

    if (!userId) {
      return of(0);
    }
    const cardId = this.cardId;

    return this.cardsService.getWallet(userId).pipe(
      map((wallet) => {
        const allCards = [...wallet.prepaid, ...wallet.cashcard, ...wallet.others];
        const card = allCards.find(c => c.id === cardId);
        return card?.balance ?? 500;
      }),
      catchError(() => of(500))
    );
  }
}