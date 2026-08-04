import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { PIN_PATTERN, sanitizePinInput } from '../../../utils/input-validation';

@Component({
  selector: 'app-security-privacy',
  templateUrl: './home-security-privacy.page.html',
  styleUrls: ['./home-security-privacy.page.scss'],
  standalone: false,
})
export class SecurityPrivacyPage {
  currentPin = '';
  newPin = '';
  confirmPin = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  readonly privacyItems = [
    {
      icon: 'eye-off-outline',
      title: 'Masked card details',
      detail: 'Balances and card numbers stay hidden until you tap the eye icon on Home.',
    },
    {
      icon: 'person-outline',
      title: 'PayNow name privacy',
      detail: 'Sender and receiver names are partially masked on transfers and alerts.',
    },
    {
      icon: 'lock-closed-outline',
      title: 'PIN-protected sign in',
      detail: 'Your 6-digit PIN is required every time you open the app.',
    },
  ];

  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  goBack(): void {
    this.router.navigate(['/tabs/home/home-more']);
  }

  onCurrentPinInput(event: Event): void {
    this.currentPin = sanitizePinInput((event.target as HTMLInputElement).value);
    this.clearMessages();
  }

  onNewPinInput(event: Event): void {
    this.newPin = sanitizePinInput((event.target as HTMLInputElement).value);
    this.clearMessages();
  }

  onConfirmPinInput(event: Event): void {
    this.confirmPin = sanitizePinInput((event.target as HTMLInputElement).value);
    this.clearMessages();
  }

  submitChangePin(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!PIN_PATTERN.test(this.currentPin)) {
      this.errorMessage = 'Enter your current 6-digit PIN.';
      return;
    }

    if (!PIN_PATTERN.test(this.newPin)) {
      this.errorMessage = 'New PIN must be exactly 6 digits.';
      return;
    }

    if (this.newPin !== this.confirmPin) {
      this.errorMessage = 'New PIN and confirmation do not match.';
      return;
    }

    if (this.newPin === this.currentPin) {
      this.errorMessage = 'Choose a different PIN from your current one.';
      return;
    }

    const userId = this.auth.userId;
    if (!userId) {
      this.errorMessage = 'Please sign in again to change your PIN.';
      return;
    }

    this.isSubmitting = true;
    this.auth
      .changePin({
        userId,
        currentPin: this.currentPin,
        newPin: this.newPin,
        confirmPin: this.confirmPin,
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.currentPin = '';
          this.newPin = '';
          this.confirmPin = '';
          this.successMessage = 'PIN updated successfully. Use your new PIN next time you sign in.';
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage =
            err.error?.error || 'Could not update PIN. Check your current PIN and try again.';
        },
      });
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
