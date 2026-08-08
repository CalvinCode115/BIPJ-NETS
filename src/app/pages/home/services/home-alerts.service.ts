import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { AppNotification, NotificationsService } from '../../../services/notifications.service';

@Injectable({
  providedIn: 'root',
})
export class HomeAlertsService {
  private loginAlertTimer: ReturnType<typeof setTimeout> | null = null;
  loginAlertQueue: AppNotification[] = [];
  visibleLoginAlert: AppNotification | null = null;

  constructor(private notificationsService: NotificationsService) {}

  list(userId: string): Observable<{ notifications: AppNotification[]; unreadCount: number }> {
    return this.notificationsService.list(userId).pipe(
      map((response) => ({
        notifications: response.notifications,
        unreadCount: response.unreadCount,
      }))
    );
  }

  markAllRead(userId: string): Observable<{ unreadCount: number }> {
    return this.notificationsService.markAllRead(userId);
  }

  queueLoginAlerts(unread: AppNotification[]): void {
    this.clearLoginAlertTimer();
    this.loginAlertQueue = unread.slice(0, 3);
    this.visibleLoginAlert = null;
    this.showNext();
  }

  dismissVisibleAlert(): void {
    this.clearLoginAlertTimer();
    this.visibleLoginAlert = null;
    if (this.loginAlertQueue.length) {
      this.showNext();
    }
  }

  get overflowCount(): number {
    if (!this.visibleLoginAlert) {
      return 0;
    }
    return this.loginAlertQueue.length;
  }

  clearLoginAlertTimer(): void {
    if (this.loginAlertTimer) {
      clearTimeout(this.loginAlertTimer);
      this.loginAlertTimer = null;
    }
  }

  private showNext(): void {
    const next = this.loginAlertQueue.shift();
    if (!next) {
      return;
    }
    this.visibleLoginAlert = next;
    this.clearLoginAlertTimer();
    this.loginAlertTimer = setTimeout(() => this.dismissVisibleAlert(), 7000);
  }
}
