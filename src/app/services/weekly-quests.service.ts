import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClaimResponse, WeeklyQuestsResponse } from './quest.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class WeeklyQuestsService {

  constructor(private http: HttpClient) {}

  getWeeklyQuests(userId: string): Observable<WeeklyQuestsResponse> {
    return this.http.get<WeeklyQuestsResponse>(`${environment.apiUrl}/users/${userId}/quests/weekly`);
  }

  claimQuest(userId: string, templateId: string): Observable<ClaimResponse> {
    return this.http.post<ClaimResponse>(
      `${environment.apiUrl}/users/${userId}/quests/weekly/${templateId}/claim`,
      {}
    );
  }
}
