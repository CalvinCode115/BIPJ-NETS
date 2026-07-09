import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PIN_PATTERN, sanitizePhoneDigits, sanitizePinInput } from '../../utils/input-validation';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  phoneDigits = '';
  pin = '';
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

  onPhoneInput(event: Event): void {
    this.phoneDigits = sanitizePhoneDigits((event.target as HTMLInputElement).value);
  }

  onPinInput(event: Event): void {
    this.pin = sanitizePinInput((event.target as HTMLInputElement).value);
  }

  goToSignup(): void {
    this.router.navigate(['/signup']);
  }

  submitLogin(): void {
    this.errorMessage = '';

    if (this.phoneDigits.length !== 8) {
      this.errorMessage = 'Enter your 8-digit mobile number.';
      return;
    }

    if (!PIN_PATTERN.test(this.pin)) {
      this.errorMessage = 'PIN must be exactly 6 digits.';
      return;
    }

    this.isLoading = true;
    this.auth.login(this.phoneDigits, this.pin).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/tabs/home'], { replaceUrl: true });
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.errorMessage = 'Invalid phone number or PIN.';
          return;
        }
        this.errorMessage =
          err.error?.error ||
          'Sign in failed. Check your phone and PIN, or restart the backend (cd backend && npm start).';
      },
    });
  }
}
