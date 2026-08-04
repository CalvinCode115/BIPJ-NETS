import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  meta?: Record<string, unknown> | null;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  constructor(private http: HttpClient) {}

  list(userId: string): Observable<NotificationsResponse> {
    return this.http.get<NotificationsResponse>(`${API_BASE_URL}/users/${userId}/notifications`).pipe(
      catchError(() =>
        of({
          notifications: [],
          unreadCount: 0,
        })
      )
    );
  }

  markRead(userId: string, notificationId: string): Observable<{ unreadCount: number }> {
    return this.http
      .patch<{ unreadCount: number }>(
        `${API_BASE_URL}/users/${userId}/notifications/${notificationId}/read`,
        {}
      )
      .pipe(catchError(() => of({ unreadCount: 0 })));
  }

  markAllRead(userId: string): Observable<{ unreadCount: number }> {
    return this.http
      .patch<{ unreadCount: number }>(`${API_BASE_URL}/users/${userId}/notifications/read-all`, {})
      .pipe(catchError(() => of({ unreadCount: 0 })));
  }
}
