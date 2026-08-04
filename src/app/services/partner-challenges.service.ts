import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClaimResponse, PartnerChallengesResponse } from './quest.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class PartnerChallengesService {

  constructor(private http: HttpClient) {}

  getChallenges(userId: string): Observable<PartnerChallengesResponse> {
    return this.http.get<PartnerChallengesResponse>(`${environment.apiUrl}/users/${userId}/challenges`);
  }

  startChallenge(userId: string, challengeId: string): Observable<{ success: boolean; alreadyStarted: boolean }> {
    return this.http.post<{ success: boolean; alreadyStarted: boolean }>(
      `${environment.apiUrl}/users/${userId}/challenges/${challengeId}/start`,
      {}
    );
  }

  claimChallenge(userId: string, challengeId: string): Observable<ClaimResponse> {
    return this.http.post<ClaimResponse>(
      `${environment.apiUrl}/users/${userId}/challenges/${challengeId}/claim`,
      {}
    );
  }
}
