import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  EMAIL_PATTERN,
  NAME_PATTERN,
  PIN_PATTERN,
  applySanitizedNativeInput,
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePhoneDigits,
  sanitizePinInput,
} from '../../utils/input-validation';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: false,
})
export class SignupPage {
  name = '';
  phoneDigits = '';
  email = '';
  pin = '';
  confirmPin = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ionViewWillEnter(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/tabs/home'], { replaceUrl: true });
    }
  }

  onNameInput(event: Event): void {
    this.name = sanitizeNameInput((event.target as HTMLInputElement).value);
    applySanitizedNativeInput(event, this.name);
  }

  onPhoneInput(event: Event): void {
    this.phoneDigits = sanitizePhoneDigits((event.target as HTMLInputElement).value);
    applySanitizedNativeInput(event, this.phoneDigits);
  }

  onEmailInput(event: Event): void {
    this.email = sanitizeEmailInput((event.target as HTMLInputElement).value);
    applySanitizedNativeInput(event, this.email);
  }

  onPinInput(event: Event): void {
    this.pin = sanitizePinInput((event.target as HTMLInputElement).value);
    applySanitizedNativeInput(event, this.pin);
  }

  onConfirmPinInput(event: Event): void {
    this.confirmPin = sanitizePinInput((event.target as HTMLInputElement).value);
    applySanitizedNativeInput(event, this.confirmPin);
  }

  submitSignup(): void {
    this.errorMessage = '';
    const trimmedName = this.name.trim();

    if (!NAME_PATTERN.test(trimmedName)) {
      this.errorMessage = 'Name must contain letters only (e.g. Cheng Wen Mao).';
      return;
    }

    if (this.phoneDigits.length !== 8) {
      this.errorMessage = 'Enter an 8-digit mobile number.';
      return;
    }

    if (this.email.trim() && !EMAIL_PATTERN.test(this.email.trim())) {
      this.errorMessage = 'Email may only use letters, numbers, @, _, and .';
      return;
    }

    if (!PIN_PATTERN.test(this.pin)) {
      this.errorMessage = 'PIN must be exactly 6 digits.';
      return;
    }

    if (this.pin !== this.confirmPin) {
      this.errorMessage = 'PIN and confirmation do not match.';
      return;
    }

    this.isLoading = true;

    this.auth
      .register({
        name: trimmedName,
        phone: this.phoneDigits,
        pin: this.pin,
        confirmPin: this.confirmPin,
        email: this.email.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/tabs/home'], { replaceUrl: true });
        },
        error: (err: { error?: { error?: string } }) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.error ?? 'Unable to create account.';
        },
      });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
