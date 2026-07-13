import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { MarketplaceVoucher } from 'shared/marketplace.models';
import { MarketplaceService } from 'shared/marketplace.service';
import { PointsService } from 'shared/points.service';
import { SessionService } from 'shared/session.service';


@Component({
  selector: 'app-rewards-marketplace',
  templateUrl: './rewards-marketplace.page.html',
  styleUrls: ['./rewards-marketplace.page.scss'],
  standalone: false,
})
export class RewardsMarketplacePage implements OnInit {

  loading = true;
  error: string | null = null;

  vouchers: MarketplaceVoucher[] = [];
  currentPoints = 0;

  selectedVoucher: MarketplaceVoucher | null = null;
  showDetailsModal = false;
  redeeming = false;

  constructor(
    private marketplaceService: MarketplaceService,
    private pointsService: PointsService,
    private session: SessionService,
    private router: Router,
    private location: Location,
    private toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = null;

    this.marketplaceService.getVouchers().subscribe({
      next: (res) => {
        this.vouchers = res.vouchers;
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
        this.vouchers = res.vouchers;
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
        this.load(); // refresh vouchers (remaining count) + balance

        const toast = await this.toastController.create({
          message: `Redeemed! Check My Vouchers for your ${voucher.merchantName} ${voucher.description}.`,
          duration: 2500,
          position: 'top',
          color: 'success',
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
      this.router.navigate(['/rewards']);
    }
  }
}
