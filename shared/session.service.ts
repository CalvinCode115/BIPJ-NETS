import { Injectable } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';


/**
 * Thin wrapper so the quest/points/challenge services only need to know
 * about "the current userId", not the details of how auth works.
 *
 * This used to be a standalone placeholder that read a made-up localStorage
 * key nothing else in the app ever wrote to — which is why every user saw
 * user_1's data regardless of who was actually logged in. It now delegates
 * directly to the real AuthService.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {

  constructor(private auth: AuthService) {}

  get userId(): string {
    const id = this.auth.userId;
    if (!id) {
      // Surfacing this loudly on purpose: silently falling back to a
      // hardcoded user (like the old placeholder did) is exactly the bug
      // we're fixing here. If this throws, it means a quest/points page
      // rendered before login — a routing/guard issue worth fixing at the
      // source, not papering over here.
      throw new Error('SessionService.userId: no user is currently logged in.');
    }
    return id;
  }
}
