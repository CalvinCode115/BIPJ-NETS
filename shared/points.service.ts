import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PointsBalance, PointsHistoryQuery, PointsHistoryResponse } from './points.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class PointsService {

  constructor(private http: HttpClient) {}

  getBalance(userId: string): Observable<PointsBalance> {
    return this.http.get<PointsBalance>(`${environment.apiUrl}/users/${userId}/points/balance`);
  }

  getHistory(userId: string, query: PointsHistoryQuery = {}): Observable<PointsHistoryResponse> {
    let params = new HttpParams();
    if (query.search) params = params.set('search', query.search);
    if (query.startDate) params = params.set('startDate', query.startDate);
    if (query.endDate) params = params.set('endDate', query.endDate);
    if (query.limit) params = params.set('limit', query.limit.toString());

    return this.http.get<PointsHistoryResponse>(`${environment.apiUrl}/users/${userId}/points/history`, { params });
  }
}
