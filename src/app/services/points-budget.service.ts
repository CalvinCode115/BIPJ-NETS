import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { PointsBudgetStatus } from './points.models';

@Injectable({ providedIn: 'root' })
export class PointsBudgetService {

  constructor(private http: HttpClient) {}

  getBudgetStatus(userId: string): Observable<PointsBudgetStatus> {
    return this.http.get<PointsBudgetStatus>(`${API_BASE_URL}/users/${userId}/points/budget-status`);
  }
}
