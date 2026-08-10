import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { UserVoucher } from 'src/app/services/my-vouchers.models';
import { SessionService } from 'src/app/services/session.service';
import { MyVouchersService } from 'src/app/services/my-vouchers.service';

type VoucherTab = 'available' | 'used' | 'expired';

@Component({
  selector: 'app-my-vouchers',
  templateUrl: './my-vouchers.page.html',
  styleUrls: ['./my-vouchers.page.scss'],
  standalone: false,
})
export class MyVouchersPage {

  loading = true;
  error: string | null = null;

  activeTab: VoucherTab = 'available';

  available: UserVoucher[] = [];
  used: UserVoucher[] = [];
  expired: UserVoucher[] = [];

  selectedVoucher: UserVoucher | null = null;
  showDetailsModal = false;

  searchTerm = '';
  sourceFilter: 'all' | 'purchased' | 'reward' = 'all';

  constructor(
    private myVouchersService: MyVouchersService,
    private session: SessionService,
    private router: Router,
    private location: Location
  ) {}

  ionViewWillEnter(): void {
    this.load();
  }

  selectSourceFilter(value: 'all' | 'purchased' | 'reward'): void {
    this.sourceFilter = value;
  }

  /** Available, filtered by source + search, sorted soonest-expiring first. */
  get filteredAvailable(): UserVoucher[] {
    return this.applyFilters(this.available).sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
    );
  }

  /** Anything expiring within a week — pinned to the top as its own section. */
  get expiringSoonVouchers(): UserVoucher[] {
    return this.filteredAvailable.filter((v) => this.daysUntilExpiry(v) <= 7);
  }

  get otherAvailableVouchers(): UserVoucher[] {
    return this.filteredAvailable.filter((v) => this.daysUntilExpiry(v) > 7);
  }

  get filteredUsed(): UserVoucher[] {
    return this.applyFilters(this.used);
  }

  get filteredExpired(): UserVoucher[] {
    return this.applyFilters(this.expired);
  }

  private applyFilters(vouchers: UserVoucher[]): UserVoucher[] {
    let result = vouchers;

    if (this.sourceFilter === 'purchased') {
      result = result.filter((v) => v.source !== 'challenge');
    } else if (this.sourceFilter === 'reward') {
      result = result.filter((v) => v.source === 'challenge');
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (v) => v.merchantName.toLowerCase().includes(term) || v.description.toLowerCase().includes(term)
      );
    }

    return result;
  }

  /** Whether the current filter/search would explain an empty list on its own (i.e. not truly empty). */
  get isFiltering(): boolean {
    return !!this.searchTerm.trim() || this.sourceFilter !== 'all';
  }

  emptyFilterMessage(): string {
    if (this.searchTerm.trim()) {
      return `No vouchers match "${this.searchTerm}".`;
    }
    if (this.sourceFilter === 'reward') {
      return 'No reward vouchers here yet — complete a partner challenge to earn one.';
    }
    if (this.sourceFilter === 'purchased') {
      return 'No purchased vouchers here yet.';
    }
    return '';
  }

  goToMarketplace(): void {
    this.router.navigate(['/tabs/rewards/rewards-marketplace']);
  }

  private load(): void {
    this.loading = true;
    this.error = null;

    this.myVouchersService.getVouchers(this.session.userId).subscribe({
      next: (res) => {
        this.available = res.available;
        this.used = res.used;
        this.expired = res.expired;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load vouchers', err);
        this.error = 'Could not load your vouchers. Pull down to try again.';
        this.loading = false;
      },
    });
  }

  refresh(event?: CustomEvent): void {
    this.myVouchersService.getVouchers(this.session.userId).subscribe({
      next: (res) => {
        this.available = res.available;
        this.used = res.used;
        this.expired = res.expired;
        (event?.target as any)?.complete?.();
      },
      error: (err) => {
        console.error('Failed to refresh vouchers', err);
        (event?.target as any)?.complete?.();
      },
    });
  }

  openDetails(voucher: UserVoucher): void {
    this.selectedVoucher = voucher;
    this.showDetailsModal = true;
  }

  closeDetails(): void {
    this.showDetailsModal = false;
    this.selectedVoucher = null;
  }

  /** Days left until expiry — used to highlight "expiring soon" in orange. */
  daysUntilExpiry(voucher: UserVoucher): number {
    const ms = new Date(voucher.expiresAt).getTime() - Date.now();
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }
}