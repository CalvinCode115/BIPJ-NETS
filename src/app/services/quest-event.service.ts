import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { QuestEvent } from './quest.models';
import { environment } from 'src/environments/environment';

/**
 * Call this from anywhere else in the app (Pay flow, Travel bookings, etc.)
 * right after a real user action completes, so quest/challenge progress
 * stays in sync. This is the ONE integration point the rest of the team
 * needs to wire up.
 *
 * Example, after a successful payment:
 *   this.questEvents.record(userId, {
 *     eventType: 'transaction',
 *     amount: 12.50,
 *     merchantId: 'starbucks-somerset',
 *     merchantCategory: 'F&B',
 *     isNewMerchant: false,
 *   }).subscribe();
 */
@Injectable({ providedIn: 'root' })
export class QuestEventService {

  constructor(private http: HttpClient) {}

  record(userId: string, event: QuestEvent): Observable<{ success: boolean; pointsAwarded: number }> {
    return this.http.post<{ success: boolean; pointsAwarded: number }>(
      `${environment.apiUrl}/users/${userId}/quests/events`,
      event
    );
  }
}
