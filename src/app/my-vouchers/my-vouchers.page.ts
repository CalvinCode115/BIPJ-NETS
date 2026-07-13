import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { UserVoucher } from 'shared/my-vouchers.models';
import { SessionService } from 'shared/session.service';
import { MyVouchersService } from 'shared/my-vouchers.service';

type VoucherTab = 'available' | 'used' | 'expired';

@Component({
  selector: 'app-my-vouchers',
  templateUrl: './my-vouchers.page.html',
  styleUrls: ['./my-vouchers.page.scss'],
  standalone: false,
})
export class MyVouchersPage implements OnInit {

  loading = true;
  error: string | null = null;

  activeTab: VoucherTab = 'available';

  available: UserVoucher[] = [];
  used: UserVoucher[] = [];
  expired: UserVoucher[] = [];

  selectedVoucher: UserVoucher | null = null;
  showDetailsModal = false;

  // ⚠️ TEST/DEV ONLY — lets you simulate the future Pay/QR auto-apply hook
  // so you can see the Used tab work before that integration exists.
  testMerchant = '';
  testLocation = '';
  markingUsed = false;

  constructor(
    private myVouchersService: MyVouchersService,
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
    this.testMerchant = voucher.merchantName;
    this.testLocation = '';
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

  markAsUsed(voucher: UserVoucher): void {
    if (this.markingUsed) return;
    this.markingUsed = true;

    this.myVouchersService.markUsed(this.session.userId, voucher.id, this.testMerchant, this.testLocation).subscribe({
      next: async () => {
        this.markingUsed = false;
        this.closeDetails();
        this.load();

        const toast = await this.toastController.create({
          message: 'Voucher marked as used (test only).',
          duration: 2000,
          position: 'top',
          color: 'success',
        });
        await toast.present();
      },
      error: async (err) => {
        this.markingUsed = false;
        console.error('Failed to mark voucher as used', err);

        const toast = await this.toastController.create({
          message: err?.error?.error || 'Could not mark this voucher as used.',
          duration: 2000,
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
