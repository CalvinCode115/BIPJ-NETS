import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { FxTrackerService } from './fx-tracker.service';
import { FxInsightWithPrediction } from './fx-tracker.model';
import { DESTINATIONS, DEFAULT_DESTINATION } from '../services/destination.config';
import { DestinationConfig } from '../services/destination.config';

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

  get baseCurrency(): string {
    return this.isReversed ? this.currentDestination.currencyCode : this.currentDestination.homeCurrencyCode;
  }

  get targetCurrency(): string {
    return this.isReversed ? this.currentDestination.homeCurrencyCode : this.currentDestination.currencyCode;
  }

  get destination(): string {
    return this.currentDestination.country;
  }

  chart: Chart | null = null;

  constructor(
    private fxService: FxTrackerService,
    private location: Location
  ) {}

  ngOnInit() {
    // Load selected destination from localStorage (shared with travel page)
    const savedDest = localStorage.getItem('nets_selected_destination');
    if (savedDest) {
      if (DESTINATIONS[savedDest]) {
        // Rich destination — simple ID lookup
        this.currentDestination = DESTINATIONS[savedDest];
      } else {
        // Exotic destination — stored as JSON object
        try {
          const parsed = JSON.parse(savedDest);
          if (parsed && parsed.id) {
            // Ensure required fields exist
            this.currentDestination = {
              ...parsed,
              homeCurrencyCode: parsed.homeCurrencyCode || 'SGD',
              fxPair: Array.isArray(parsed.fxPair) ? parsed.fxPair : ['SGD', parsed.currencyCode || 'USD']
            };
          }
        } catch {
          // Invalid JSON, keep default
        }
      }
    }
    this.loadFxData();
  }

  setDirection(reversed: boolean) {
    if (this.isReversed === reversed) return;
    this.isReversed = reversed;
    this.loadFxData();
  }

  loadFxData() {
    this.isLoading = true;
    this.error = null;
    this.insight = null;
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    // Pass destination object — prediction is included!
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
  renderChart() {
    if (!this.fxChartRef || !this.insight) return;
    const ctx = this.fxChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    if (this.chart) this.chart.destroy();

    const hist = this.insight.rates;
    const pred = this.insight.prediction.forecastRates;
    const upper = this.insight.prediction.confidenceUpper;
    const lower = this.insight.prediction.confidenceLower;

    // All dates for x-axis
    const histLabels = hist.map(r => {
      const d = new Date(r.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const predLabels = pred.map(r => {
      const d = new Date(r.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    // Gap between historical and prediction (connecting point)
    const allLabels = [...histLabels, ...predLabels];

    // Historical data + null padding for prediction period
    const histData = [...hist.map(r => r.rate), ...new Array(pred.length).fill(null)];
    // Null padding for historical period + prediction data
    const predData = [...new Array(hist.length - 1).fill(null), hist[hist.length - 1].rate, ...pred.map(r => r.rate)];
    // Confidence bands
    const upperData = [...new Array(hist.length).fill(null), ...upper];
    const lowerData = [...new Array(hist.length).fill(null), ...lower];

    const trendColor = this.insight.trend === 'up' ? '#d71920' :
      this.insight.trend === 'down' ? '#34c759' : '#ff9500';
    const predColor = '#8e8e93';

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          // Confidence band (fill between upper and lower)
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
          // Historical line (solid)
          {
            label: `${this.baseCurrency} → ${this.targetCurrency} (Historical)`,
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
          // Prediction line (dotted)
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
              filter: (item) => item.text !== 'Confidence' && item.text !== 'Confidence Lower',
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
              label: (context) => {
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
            ticks: { color: '#8e8e93', font: { size: 10 }, callback: (v) => Number(v).toFixed(4) }
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
    if (this.insight.trend === 'up') return `${this.baseCurrency} Weakening`;
    if (this.insight.trend === 'down') return `${this.baseCurrency} Strengthening`;
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
}