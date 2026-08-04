import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CheckinResponse, CheckinStatus } from './daily-checkin.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class DailyCheckinService {

  constructor(private http: HttpClient) {}

  getStatus(userId: string): Observable<CheckinStatus> {
    return this.http.get<CheckinStatus>(`${environment.apiUrl}/users/${userId}/checkin/status`);
  }

  checkIn(userId: string): Observable<CheckinResponse> {
    return this.http.post<CheckinResponse>(`${environment.apiUrl}/users/${userId}/checkin`, {});
  }
}
