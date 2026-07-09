import { Injectable } from '@angular/core';

/**
 * TODO: replace this with however your app's `routes/auth.js` login flow
 * already tracks the signed-in user (e.g. a shared AuthService, a value
 * stored after PIN login, etc). This is a placeholder so the quest/challenge
 * services below have something to call — it reads/writes a simple key so
 * you can wire it up quickly, but it should be replaced with your real
 * current-user source rather than kept long-term.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {

  private readonly STORAGE_KEY = 'nets_current_user_id';

  get userId(): string {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      // Fallback so the app doesn't crash before real auth is wired in —
      // matches one of the seeded demo users (user_1 / Alex Tan).
      console.warn('SessionService: no logged-in user found, defaulting to user_1');
      return 'user_1';
    }
    return stored;
  }

  setUserId(userId: string): void {
    localStorage.setItem(this.STORAGE_KEY, userId);
  }
}
