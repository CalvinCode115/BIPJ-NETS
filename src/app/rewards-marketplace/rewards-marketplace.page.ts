import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { MarketplaceVoucher, VoucherCategory } from 'shared/marketplace.models';
import { MarketplaceService } from 'shared/marketplace.service';
import { PointsService } from 'shared/points.service';
import { SessionService } from 'shared/session.service';

type RedeemableFilter = 'all' | 'redeemable' | 'not-redeemable';

@Component({
  selector: 'app-rewards-marketplace',
  templateUrl: './rewards-marketplace.page.html',
  styleUrls: ['./rewards-marketplace.page.scss'],
  standalone: false,
})
export class RewardsMarketplacePage {

  loading = true;
  error: string | null = null;

  allVouchers: MarketplaceVoucher[] = []; // full sorted list from the backend
  filteredVouchers: MarketplaceVoucher[] = []; // after filters applied
  currentPoints = 0;

  selectedVoucher: MarketplaceVoucher | null = null;
  showDetailsModal = false;
  redeeming = false;

  // Tracks voucher IDs whose logo image failed to load (file missing,
  // broken path, etc.) — falls back to the colored icon tile instead.
  private logoFailedIds = new Set<string>();

  // ---- Filters ----
  showFilterModal = false;
  readonly categories: VoucherCategory[] = ['Retail', 'Dining', 'Transport', 'Groceries', 'Travel'];
  maxPointsCost = 15000; // recomputed from real data once vouchers load
  pointsRange = { lower: 0, upper: 15000 };
  redeemableFilter: RedeemableFilter = 'all';
  selectedCategory: VoucherCategory | null = null; // null = All

  // Brand-ish accent colors for the logo tiles — NOT real merchant logos
  // (using actual trademarked brand logo images would be a copyright
  // issue), just a colored badge that makes each voucher easier to
  // recognize at a glance.
  private readonly brandColors: Record<string, string> = {
    'LiHO Tea': '#00A19A',
    Grab: '#00B14F',
    Starbucks: '#00704A',
    'Boost Juice': '#F97B22',
    Watsons: '#00A9E0',
    Decathlon: '#0082C3',
    'National Day 50% F&B Discount': '#D71920',
    'Cotton On': '#1A1A1A',
    Klook: '#FF5722',
  };

  constructor(
    private marketplaceService: MarketplaceService,
    private pointsService: PointsService,
    private session: SessionService,
    private router: Router,
    private location: Location,
    private toastController: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = null;

    this.marketplaceService.getVouchers().subscribe({
      next: (res) => {
        this.allVouchers = res.vouchers;
        this.maxPointsCost = Math.max(...res.vouchers.map((v) => v.pointsCost), 0);
        this.pointsRange = { lower: 0, upper: this.maxPointsCost };
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load marketplace vouchers', err);
        this.error = 'Could not load vouchers. Pull down to try again.';
        this.loading = false;
      },
    });

    this.pointsService.getBalance(this.session.userId).subscribe({
      next: (res) => (this.currentPoints = res.totalPoints),
      error: (err) => console.error('Failed to load points balance', err),
    });
  }

  refresh(event?: CustomEvent): void {
    this.marketplaceService.getVouchers().subscribe({
      next: (res) => {
        this.allVouchers = res.vouchers;
        this.applyFilters();
        (event?.target as any)?.complete?.();
      },
      error: (err) => {
        console.error('Failed to refresh vouchers', err);
        (event?.target as any)?.complete?.();
      },
    });
    this.pointsService.getBalance(this.session.userId).subscribe({
      next: (res) => (this.currentPoints = res.totalPoints),
    });
  }

  brandColor(merchantName: string): string {
    return this.brandColors[merchantName] ?? '#7b2fd6';
  }

  /** True if this voucher should show its real logo image right now. */
  showLogo(voucher: MarketplaceVoucher): boolean {
    return !!voucher.logoUrl && !this.logoFailedIds.has(voucher.id);
  }

  /** Called from (error) on the <img> — falls back to the colored icon tile. */
  onLogoError(voucherId: string): void {
    this.logoFailedIds.add(voucherId);
  }

  // ---- Filters ----

  applyFilters(): void {
    this.filteredVouchers = this.allVouchers.filter((v) => {
      if (v.pointsCost < this.pointsRange.lower || v.pointsCost > this.pointsRange.upper) return false;
      if (this.redeemableFilter === 'redeemable' && !v.redeemable) return false;
      if (this.redeemableFilter === 'not-redeemable' && v.redeemable) return false;
      if (this.selectedCategory && v.category !== this.selectedCategory) return false;
      return true;
    });
  }

  onPointsRangeChange(event: CustomEvent): void {
    const value = (event.detail as any).value;
    this.pointsRange = { lower: value.lower, upper: value.upper };
  }

  selectCategory(category: VoucherCategory | null): void {
    this.selectedCategory = this.selectedCategory === category ? null : category;
  }

  resetFilters(): void {
    this.pointsRange = { lower: 0, upper: this.maxPointsCost };
    this.redeemableFilter = 'all';
    this.selectedCategory = null;
  }

  applyFiltersAndClose(): void {
    this.applyFilters();
    this.showFilterModal = false;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.redeemableFilter !== 'all') count++;
    if (this.selectedCategory) count++;
    if (this.pointsRange.lower > 0 || this.pointsRange.upper < this.maxPointsCost) count++;
    return count;
  }

  // ---- Voucher details / redeem ----

  openDetails(voucher: MarketplaceVoucher): void {
    this.selectedVoucher = voucher;
    this.showDetailsModal = true;
  }

  closeDetails(): void {
    this.showDetailsModal = false;
    this.selectedVoucher = null;
  }

  canAfford(voucher: MarketplaceVoucher): boolean {
    return this.currentPoints >= voucher.pointsCost;
  }

  redeem(voucher: MarketplaceVoucher): void {
    if (this.redeeming || !voucher.redeemable || !this.canAfford(voucher)) return;
    this.redeeming = true;

    this.marketplaceService.redeemVoucher(this.session.userId, voucher.id).subscribe({
      next: async () => {
        this.redeeming = false;
        this.closeDetails();
        this.load();

        const toast = await this.toastController.create({
          message: `Redeemed! Your ${voucher.merchantName} ${voucher.description} is ready.`,
          duration: 4000,
          position: 'top',
          color: 'success',
          buttons: [
            {
              text: 'View',
              handler: () => this.router.navigate(['/tabs/rewards/my-vouchers']),
            },
          ],
        });
        await toast.present();
      },
      error: async (err) => {
        this.redeeming = false;
        console.error('Failed to redeem voucher', err);

        const toast = await this.toastController.create({
          message: err?.error?.error || 'Could not redeem this voucher. Please try again.',
          duration: 2500,
          position: 'top',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }
}