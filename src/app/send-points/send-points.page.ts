import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { PointsTransferService } from 'shared/points-transfer.service';
import { PointsService } from 'shared/points.service';
import { SessionService } from 'shared/session.service';

@Component({
  selector: 'app-send-points',
  templateUrl: './send-points.page.html',
  styleUrls: ['./send-points.page.scss'],
  standalone: false,
})
export class SendPointsPage {

  balance = 0;
  contactNumber = '';
  amount: number | null = null;
  comment = '';

  quickAmounts = [100, 250, 500, 1000];

  // Payee lookup state
  payeeName: string | null = null;
  payeeNotFound = false;
  isOwnNumber = false; // true when the entered number is the sender's own
  lookupInProgress = false;
  private lookupDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  sending = false;

  constructor(
    private pointsTransferService: PointsTransferService,
    private pointsService: PointsService,
    private session: SessionService,
    private router: Router,
    private location: Location,
    private toastController: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.pointsService.getBalance(this.session.userId).subscribe({
      next: (res) => (this.balance = res.totalPoints),
      error: (err) => console.error('Failed to load points balance', err),
    });
  }

  get isFormValid(): boolean {
    return (
      this.contactNumber.length === 8 &&
      !!this.payeeName &&
      !this.isOwnNumber &&
      !!this.amount &&
      this.amount > 0 &&
      this.amount <= this.balance
    );
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }

  /** Debounced so we don't look up the phone number on every keystroke. */
  onContactNumberChange(value: string): void {
    this.contactNumber = value;
    this.payeeName = null;
    this.payeeNotFound = false;
    this.isOwnNumber = false;

    if (this.lookupDebounceHandle) {
      clearTimeout(this.lookupDebounceHandle);
    }

    if (value.length !== 8) {
      return;
    }

    this.lookupDebounceHandle = setTimeout(() => this.lookupPayee(value), 400);
  }

  private lookupPayee(phone: string): void {
    this.lookupInProgress = true;
    this.pointsTransferService.lookupByPhone(phone).subscribe({
      next: (res) => {
        this.lookupInProgress = false;

        if (!res.found) {
          this.payeeName = null;
          this.payeeNotFound = true;
          this.isOwnNumber = false;
          return;
        }

        if (res.userId === this.session.userId) {
          // Caught here, client-side, so the user never even sees their
          // own name before finding out they can't send to themselves.
          this.payeeName = null;
          this.payeeNotFound = false;
          this.isOwnNumber = true;
          return;
        }

        this.payeeName = res.name ?? null;
        this.payeeNotFound = false;
        this.isOwnNumber = false;
      },
      error: (err) => {
        this.lookupInProgress = false;
        this.payeeName = null;
        this.payeeNotFound = true;
        this.isOwnNumber = false;
        console.error('Failed to look up payee', err);
      },
    });
  }

  selectQuickAmount(value: number): void {
    this.amount = value;
  }

  sendPoints(): void {
    if (!this.isFormValid || this.sending || !this.amount) {
      return;
    }

    this.sending = true;

    this.pointsTransferService
      .sendPoints(this.session.userId, {
        toPhone: this.contactNumber,
        amount: this.amount,
        comment: this.comment || undefined,
      })
      .subscribe({
        next: async (res) => {
          this.sending = false;
          const toast = await this.toastController.create({
            message: `Sent ${res.amount} points to ${res.toName}!`,
            duration: 2500,
            position: 'top',
            color: 'success',
          });
          await toast.present();
          this.router.navigate(['/tabs/rewards']);
        },
        error: async (err) => {
          this.sending = false;
          console.error('Failed to send points', err);
          const toast = await this.toastController.create({
            message: err?.error?.error || 'Could not send points. Please try again.',
            duration: 2500,
            position: 'top',
            color: 'danger',
          });
          await toast.present();
        },
      });
  }

  goBackToBalance(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/tabs/rewards']);
    }
  }
}