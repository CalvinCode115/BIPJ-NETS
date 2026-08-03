import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClaimResponse, DailyQuestsResponse } from './quest.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class DailyQuestsService {

  constructor(private http: HttpClient) {}

  getDailyQuests(userId: string): Observable<DailyQuestsResponse> {
    return this.http.get<DailyQuestsResponse>(`${environment.apiUrl}/users/${userId}/quests/daily`);
  }

  claimQuest(userId: string, templateId: string): Observable<ClaimResponse> {
    return this.http.post<ClaimResponse>(
      `${environment.apiUrl}/users/${userId}/quests/daily/${templateId}/claim`,
      {}
    );
  }
}
