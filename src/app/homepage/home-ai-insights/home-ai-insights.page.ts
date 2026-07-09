import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PeriodOption, TransactionsService } from '../../services/transactions.service';

interface SummaryStat {
  label: string;
  value: string;
}

interface DonutSegment {
  label: string;
  amount: number;
  color: string;
  percent?: number;
}

interface DeepDiveCard {
  id: string;
  heading: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  total: number;
  segments: DonutSegment[];
}

interface TopSpot {
  rank: number;
  name: string;
  amount: number;
  category: string;
  visits: number;
}

interface SmartInsight {
  title: string;
  message: string;
  icon: string;
  color: string;
  bg: string;
}

@Component({
  selector: 'app-ai-insights',
  templateUrl: './home-ai-insights.page.html',
  styleUrls: ['./home-ai-insights.page.scss'],
  standalone: false,
})
export class AiInsightsPage implements OnInit {
  summaryMonth = '';
  isLoading = false;
  loadError = '';
  isPeriodSheetOpen = false;

  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  availablePeriods: PeriodOption[] = [];

  summaryStats: SummaryStat[] = [];
  deepDives: DeepDiveCard[] = [];
  dnaTraits: string[] = [];
  topSpots: TopSpot[] = [];
  smartInsights: SmartInsight[] = [];
  transportAnalysis = {
    totalTransport: 0,
    totalTrips: 0,
    highlight: '',
  };

  constructor(
    private router: Router,
    private auth: AuthService,
    private transactionsService: TransactionsService
  ) {}

  ngOnInit(): void {
    this.loadInsights();
  }

  closeInsights(): void {
    this.router.navigate(['/tabs/home']);
  }

  onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.applyPeriodValue(value);
  }

  openPeriodSheet(): void {
    this.isPeriodSheetOpen = true;
  }

  closePeriodSheet(): void {
    this.isPeriodSheetOpen = false;
  }

  onPeriodSelected(value: string): void {
    this.applyPeriodValue(value);
    this.isPeriodSheetOpen = false;
  }

  get periodSheetOptions() {
    return this.availablePeriods.map((period) => ({
      id: `${period.year}-${period.month}`,
      label: period.label,
    }));
  }

  get periodSelectValue(): string {
    return `${this.selectedYear}-${this.selectedMonth}`;
  }

  private applyPeriodValue(value: string): void {
    const [year, month] = value.split('-').map(Number);
    this.selectedYear = year;
    this.selectedMonth = month;
    this.loadInsights();
  }

  getDonutGradient(dive: DeepDiveCard): string {
    let current = 0;
    const stops = dive.segments.map((segment) => {
      const start = current;
      const share = segment.percent ?? (dive.total ? (segment.amount / dive.total) * 100 : 0);
      current += share;
      return `${segment.color} ${start}% ${current}%`;
    });
    return stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#eee 0% 100%)';
  }

  private loadInsights(): void {
    const userId = this.auth.userId ?? 'user_1';
    this.isLoading = true;
    this.loadError = '';

    this.transactionsService.getInsights(userId, this.selectedMonth, this.selectedYear).subscribe({
      next: (response) => {
        this.summaryMonth = response.summaryMonth;
        this.availablePeriods = response.availablePeriods;
        this.selectedMonth = response.selectedPeriod.month;
        this.selectedYear = response.selectedPeriod.year;
        this.summaryStats = response.summaryStats;
        this.deepDives = response.deepDives ?? [];
        this.dnaTraits = response.traits ?? [];
        this.topSpots = response.topSpots;
        this.smartInsights = response.smartInsights;
        this.transportAnalysis = response.transportAnalysis ?? this.transportAnalysis;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Unable to load insights. Is the backend running?';
      },
    });
  }
}
