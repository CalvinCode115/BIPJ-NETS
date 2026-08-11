import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PhoneLookupResult, SendPointsResponse } from './points-transfer.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class PointsTransferService {

  constructor(private http: HttpClient) {}

  lookupByPhone(phone: string): Observable<PhoneLookupResult> {
    return this.http.get<PhoneLookupResult>(`${environment.apiUrl}/users/lookup-by-phone/${phone}`);
  }

  sendPoints(
    userId: string,
    payload: { toPhone: string; amount: number; comment?: string; allowPartial?: boolean }
  ): Observable<SendPointsResponse> {
    return this.http.post<SendPointsResponse>(`${environment.apiUrl}/users/${userId}/points/send`, payload);
  }
}
