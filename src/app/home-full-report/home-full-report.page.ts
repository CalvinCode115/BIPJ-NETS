import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CardContextService } from '../services/card-context.service';
import { PeriodOption, TransactionsService } from '../services/transactions.service';

interface ReportStat {
  label: string;
  value: string;
  badge: string;
  badgeType: 'positive' | 'negative' | 'neutral';
}

interface TrendMonth {
  label: string;
  spending: number;
  income: number;
}

interface CategoryBreakdown {
  name: string;
  amount: number;
  change: number;
  color: string;
  percent: number;
}

@Component({
  selector: 'app-full-report',
  templateUrl: './home-full-report.page.html',
  styleUrls: ['./home-full-report.page.scss'],
  standalone: false,
})
export class FullReportPage implements OnInit {
  reportPeriod = 'June 2026';
  compareLabel = 'May';
  isLoading = false;
  loadError = '';
  isPeriodOpen = false;

  selectedMonth = 6;
  selectedYear = 2026;
  availablePeriods: PeriodOption[] = [];

  stats: ReportStat[] = [];
  trendMonths: TrendMonth[] = [];
  categories: CategoryBreakdown[] = [];
  savingsGoalProgress = 0;
  netSaved = 0;

  constructor(
    private router: Router,
    private auth: AuthService,
    private cardContext: CardContextService,
    private transactionsService: TransactionsService
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  closeReport(): void {
    this.router.navigate(['/tabs/home']);
  }

  togglePeriodPicker(): void {
    this.isPeriodOpen = !this.isPeriodOpen;
  }

  openPeriodSheet(): void {
    this.isPeriodOpen = true;
  }

  closePeriodSheet(): void {
    this.isPeriodOpen = false;
  }

  onPeriodSelected(value: string): void {
    const [year, month] = value.split('-').map(Number);
    this.selectedYear = year;
    this.selectedMonth = month;
    this.isPeriodOpen = false;
    this.loadReport();
  }

  get periodSheetOptions() {
    return this.availablePeriods.map((period) => ({
      id: `${period.year}-${period.month}`,
      label: period.label,
    }));
  }

  onPeriodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const [year, month] = value.split('-').map(Number);
    this.selectedYear = year;
    this.selectedMonth = month;
    this.isPeriodOpen = false;
    this.loadReport();
  }

  get periodSelectValue(): string {
    return `${this.selectedYear}-${this.selectedMonth}`;
  }

  getTrendHeight(value: number, _type?: 'spending' | 'income'): number {
    const max = this.trendMonths.reduce(
      (highest, month) => Math.max(highest, month.spending, month.income),
      1
    );
    return (value / max) * 100;
  }

  private loadReport(): void {
    const userId = this.auth.userId ?? 'user_1';
    this.isLoading = true;
    this.loadError = '';

    this.transactionsService
      .getReport(userId, this.selectedMonth, this.selectedYear, this.cardContext.getSelectedCardFilters())
      .subscribe({
      next: (response) => {
        this.reportPeriod = response.reportPeriod;
        this.compareLabel = response.compareLabel;
        this.availablePeriods = response.availablePeriods;
        this.stats = response.stats as ReportStat[];
        this.trendMonths = response.trendMonths;
        this.categories = response.categories;
        this.netSaved = response.netSaved;
        this.savingsGoalProgress = response.savingsGoalProgress;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'Unable to load report. Is the backend running?';
      },
    });
  }
}
