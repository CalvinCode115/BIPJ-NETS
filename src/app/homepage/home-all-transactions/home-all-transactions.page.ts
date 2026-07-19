import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  PeriodOption,
  TransactionRecord,
  TransactionsService,
} from '../../services/transactions.service';
import { formatTransactionMeta } from '../../utils/transfer-display';

interface TransactionItem {
  id: string;
  merchant: string;
  category: string;
  time: string;
  amount: number;
  displayAmount?: string | null;
  icon: string;
  iconColor: string;
  metaLine: string;
}

interface TransactionGroup {
  date: string;
  items: TransactionItem[];
}

type TypeFilter = 'all' | 'income' | 'expenditure';

@Component({
  selector: 'app-all-transactions',
  templateUrl: './home-all-transactions.page.html',
  styleUrls: ['./home-all-transactions.page.scss'],
  standalone: false,
})
export class AllTransactionsPage implements OnInit {
  searchQuery = '';
  isFilterOpen = false;
  isPeriodSheetOpen = false;
  activeTypeFilter: TypeFilter = 'all';
  activeCategoryFilter = 'All';
  isLoading = false;
  loadError = '';

  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  availablePeriods: PeriodOption[] = [];

  typeFilters: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'income', label: 'Income' },
    { id: 'expenditure', label: 'Expenditure' },
  ];

  categoryFilters = ['All', 'Coffee', 'Dining', 'Transport', 'Groceries', 'Retail', 'Currency Exchange'];

  summary = {
    month: '',
    monthLabel: '',
    totalSpending: 0,
    transactionCount: 0,
    avgPerDay: 0,
  };

  private allGroups: TransactionGroup[] = [];
  visibleCount = 5;

  constructor(
    private router: Router,
    private auth: AuthService,
    private transactionsService: TransactionsService
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  closeTransactions(): void {
    this.router.navigate(['/tabs/home']);
  }

  toggleFilters(): void {
    this.isFilterOpen = !this.isFilterOpen;
  }

  setTypeFilter(filter: TypeFilter): void {
    this.activeTypeFilter = filter;
    this.loadTransactions();
  }

  setCategoryFilter(category: string): void {
    this.activeCategoryFilter = category;
    this.loadTransactions();
  }

  onSearchChange(): void {
    this.loadTransactions();
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
    this.visibleCount = 5;
    this.loadTransactions();
  }

  get hasActiveFilters(): boolean {
    return this.activeTypeFilter !== 'all' || this.activeCategoryFilter !== 'All';
  }

  get filteredGroups(): TransactionGroup[] {
    return this.allGroups.slice(0, this.visibleCount);
  }

  getGroupTotal(items: TransactionItem[]): number {
    return items.reduce((sum, item) => sum + item.amount, 0);
  }

  formatAmount(amount: number): string {
    const prefix = amount >= 0 ? '+' : '-';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  }

  loadMore(): void {
    this.visibleCount += 3;
  }

  get canLoadMore(): boolean {
    return this.visibleCount < this.allGroups.length;
  }

  private loadTransactions(): void {
    const userId = this.auth.userId ?? 'user_1';
    this.isLoading = true;
    this.loadError = '';

    this.transactionsService
      .getTransactions(userId, {
        month: this.selectedMonth,
        year: this.selectedYear,
        search: this.searchQuery.trim(),
        type: this.activeTypeFilter,
        category: this.activeCategoryFilter,
      })
      .subscribe({
        next: (response) => {
          this.summary = response.summary;
          this.availablePeriods = response.availablePeriods;
          this.selectedMonth = response.selectedPeriod.month;
          this.selectedYear = response.selectedPeriod.year;
          this.allGroups = this.groupTransactions(response.transactions);
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.loadError = 'Unable to load transactions. Is the backend running?';
          this.allGroups = [];
        },
      });
  }

  private groupTransactions(transactions: TransactionRecord[]): TransactionGroup[] {
    const groups = new Map<string, TransactionItem[]>();

    transactions.forEach((txn) => {
      const metaLine = formatTransactionMeta(txn);
      const items = groups.get(txn.date) ?? [];
      items.push({
        id: txn.id,
        merchant: txn.merchant,
        category: txn.category,
        time: txn.time,
        amount: txn.amount,
        displayAmount: txn.displayAmount,
        icon: txn.icon,
        iconColor: txn.iconColor,
        metaLine,
      });
      groups.set(txn.date, items);
    });

    return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
  }
}
