import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { PointsHistoryEntry } from 'shared/points.models';
import { PointsService } from 'shared/points.service';
import { SessionService } from 'shared/session.service';


type FilterType = 'all' | 'earned' | 'spent';

@Component({
  selector: 'app-point-history',
  templateUrl: './point-history.page.html',
  styleUrls: ['./point-history.page.scss'],
  standalone: false,
})
export class PointHistoryPage {

  loading = true;
  error: string | null = null;

  activeFilter: FilterType = 'all';
  searchTerm = '';
  startDate: string | null = null; // 'YYYY-MM-DD'
  endDate: string | null = null; // 'YYYY-MM-DD'

  showStartDatePicker = false;
  showEndDatePicker = false;

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  allTransactions: PointsHistoryEntry[] = []; // matches the current search/date filter, before Earned/Spent split
  filteredTransactions: PointsHistoryEntry[] = [];

  constructor(
    private pointsService: PointsService,
    private session: SessionService,
    private router: Router,
    private location: Location
  ) {}

  ionViewWillEnter(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = null;

    this.pointsService
      .getHistory(this.session.userId, {
        search: this.searchTerm || undefined,
        startDate: this.startDate || undefined,
        endDate: this.endDate || undefined,
      })
      .subscribe({
        next: (res) => {
          this.allTransactions = res.entries;
          this.applyFilter();
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load points history', err);
          this.error = 'Could not load your points history.';
          this.loading = false;
        },
      });
  }

  get counts() {
    return {
      all: this.allTransactions.length,
      earned: this.allTransactions.filter((t) => t.amount > 0).length,
      spent: this.allTransactions.filter((t) => t.amount < 0).length,
    };
  }

  get sectionTitle(): string {
    switch (this.activeFilter) {
      case 'earned': return 'Earned Transactions';
      case 'spent': return 'Spent Transactions';
      default: return 'All Transactions';
    }
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  private applyFilter(): void {
    switch (this.activeFilter) {
      case 'earned':
        this.filteredTransactions = this.allTransactions.filter((t) => t.amount > 0);
        break;
      case 'spent':
        this.filteredTransactions = this.allTransactions.filter((t) => t.amount < 0);
        break;
      default:
        this.filteredTransactions = this.allTransactions;
    }
  }

  /** Debounced so we don't fire a request on every keystroke. */
  onSearchChange(value: string | null | undefined): void {
    this.searchTerm = value ?? '';
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.searchDebounceHandle = setTimeout(() => this.load(), 400);
  }

  onDateRangeChange(): void {
    this.load();
  }

  onStartDateChange(value: string | string[] | null | undefined): void {
    const isoValue = Array.isArray(value) ? value[0] : value;
    this.startDate = isoValue ? isoValue.substring(0, 10) : null;
    this.showStartDatePicker = false;
    this.onDateRangeChange();
  }

  onEndDateChange(value: string | string[] | null | undefined): void {
    const isoValue = Array.isArray(value) ? value[0] : value;
    this.endDate = isoValue ? isoValue.substring(0, 10) : null;
    this.showEndDatePicker = false;
    this.onDateRangeChange();
  }

  clearDateRange(): void {
    this.startDate = null;
    this.endDate = null;
    this.load();
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }
}