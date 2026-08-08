import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HomeMonthlySummary, HomeSpendingCategory } from '../../services/home-activity.service';

@Component({
  selector: 'app-home-spending-summary',
  templateUrl: './home-spending-summary.component.html',
  styleUrls: ['./home-spending-summary.component.scss'],
  standalone: false,
})
export class HomeSpendingSummaryComponent {
  readonly Math = Math;

  @Input() monthlySummary: HomeMonthlySummary = {
    month: '',
    totalIn: 0,
    totalInChange: 0,
    totalSpent: 0,
    totalSpentChange: 0,
  };
  @Input() spendingCategories: HomeSpendingCategory[] = [];
  @Input() spendingPeriod: 'Monthly' | 'Weekly' = 'Monthly';
  @Input() periodButtonLabel = 'Monthly';

  @Output() openFullReport = new EventEmitter<void>();
  @Output() openPeriodSheet = new EventEmitter<void>();

  get maxSpendingAmount(): number {
    if (!this.spendingCategories.length) {
      return 1;
    }
    return Math.max(...this.spendingCategories.map((c) => c.amount), 1);
  }

  getBarHeight(amount: number): number {
    return (amount / this.maxSpendingAmount) * 100;
  }
}
