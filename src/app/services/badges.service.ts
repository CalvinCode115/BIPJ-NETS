import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; // TODO: adjust path to match your project's environment file
import { BadgesResponse } from './badges.models';

@Injectable({ providedIn: 'root' })
export class BadgesService {

  constructor(private http: HttpClient) {}

  getBadges(userId: string): Observable<BadgesResponse> {
    return this.http.get<BadgesResponse>(`${environment.apiUrl}/users/${userId}/badges`);
  }
}
