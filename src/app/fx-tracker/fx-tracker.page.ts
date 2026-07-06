import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { FxTrackerService } from './fx-tracker.service';
import { FxInsight } from './fx-tracker.model';

Chart.register(...registerables);

@Component({
  selector: 'app-fx-tracker',
  templateUrl: './fx-tracker.page.html',
  styleUrls: ['./fx-tracker.page.scss'],
  standalone: false,
})
export class FxTrackerPage implements OnInit {
  @ViewChild('fxChart') fxChartRef!: ElementRef;

  insight: FxInsight | null = null;
  isLoading = false;
  error: string | null = null;

  baseCurrency = 'SGD';
  targetCurrency = 'MYR';
  destination = 'Malaysia';
  chart: Chart | null = null;

  constructor(
    private fxService: FxTrackerService,
    private location: Location
  ) {}

  ngOnInit() {
    this.loadFxData();
  }

  loadFxData() {
    this.isLoading = true;
    this.error = null;

    this.fxService.getFxInsight(30).subscribe({
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
    if (!this.fxChartRef || !this.insight || this.insight.rates.length === 0) return;

    const ctx = this.fxChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const rates = this.insight.rates;
    const labels = rates.map(r => {
      const d = new Date(r.date);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    const data = rates.map(r => r.rate);

    const trendColor = this.insight.trend === 'up' ? '#d71920' : 
                       this.insight.trend === 'down' ? '#34c759' : '#ff9500';

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `SGD → MYR`,
          data,
          borderColor: trendColor,
          backgroundColor: this.hexToRgba(trendColor, 0.1),
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: trendColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a2e',
            titleColor: '#fff',
            bodyColor: '#fff',
            cornerRadius: 8,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => {
                const value = context.parsed.y ?? 0;
                return `Rate: ${value.toFixed(4)} MYR`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#8e8e93',
              font: { size: 10 },
              maxTicksLimit: 6
            }
          },
          y: {
            grid: { color: '#f0f0f0' },
            ticks: {
              color: '#8e8e93',
              font: { size: 10 },
              callback: (value) => Number(value).toFixed(3)
            }
          }
        }
      }
    });
  }

  refresh() {
    this.loadFxData();
  }

  goBack() {
    this.location.back();
  }

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
    if (this.insight.trend === 'up') return 'SGD Weakening';
    if (this.insight.trend === 'down') return 'SGD Strengthening';
    return 'Stable';
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}