import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AppNotification, NotificationsService } from '../../../services/notifications.service';
import {
  formatNotificationAmount,
  formatNotificationSender,
  formatNotificationWhen,
} from '../../../utils/notification-display';
import { NOTIF_PREFS_KEY } from '../../../utils/notification-preferences';

interface NotificationPreference {
  id: string;
  label: string;
  detail: string;
  enabled: boolean;
}

@Component({
  selector: 'app-home-notifications',
  templateUrl: './home-notifications.page.html',
  styleUrls: ['./home-notifications.page.scss'],
  standalone: false,
})
export class HomeNotificationsPage implements OnInit {
  notifications: AppNotification[] = [];
  unreadCount = 0;
  isLoading = true;

  preferences: NotificationPreference[] = [
    {
      id: 'paynow_received',
      label: 'PayNow received',
      detail: 'Alert when someone sends you money',
      enabled: true,
    },
    {
      id: 'points_received',
      label: 'NETS Points received',
      detail: 'Alert when a friend sends you points',
      enabled: true,
    },
    {
      id: 'low_balance',
      label: 'Low balance',
      detail: 'When a prepaid or CashCard drops below $50',
      enabled: true,
    },
    {
      id: 'receipt_saved',
      label: 'Receipt saved',
      detail: 'After a receipt is added to your history',
      enabled: true,
    },
  ];

  constructor(
    private router: Router,
    private auth: AuthService,
    private notificationsService: NotificationsService
  ) {}

  ngOnInit(): void {
    this.loadPreferences();
    this.loadNotifications();
  }

  goBack(): void {
    this.router.navigate(['/tabs/home/home-more']);
  }

  onPreferenceChange(pref: NotificationPreference, enabled: boolean): void {
    pref.enabled = enabled;
    this.savePreferences();
  }

  markAllRead(): void {
    const userId = this.auth.userId;
    if (!userId || this.unreadCount === 0) {
      return;
    }

    this.notificationsService.markAllRead(userId).subscribe({
      next: (response) => {
        this.unreadCount = response.unreadCount;
        this.notifications = this.notifications.map((entry) => ({ ...entry, read: true }));
      },
    });
  }

  notificationAmount(entry: AppNotification): string | null {
    return formatNotificationAmount(entry);
  }

  notificationSender(entry: AppNotification): string {
    return formatNotificationSender(entry);
  }

  formatWhen(iso: string): string {
    return formatNotificationWhen(iso);
  }

  private loadNotifications(): void {
    const userId = this.auth.userId;
    if (!userId) {
      this.isLoading = false;
      return;
    }

    this.notificationsService.list(userId).subscribe({
      next: (response) => {
        this.notifications = response.notifications;
        this.unreadCount = response.unreadCount;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private loadPreferences(): void {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    try {
      const raw = sessionStorage.getItem(`${NOTIF_PREFS_KEY}_${userId}`);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw) as Record<string, boolean>;
      this.preferences.forEach((pref) => {
        if (typeof saved[pref.id] === 'boolean') {
          pref.enabled = saved[pref.id];
        }
      });
    } catch {
      // ignore invalid storage
    }
  }

  private savePreferences(): void {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    const payload = Object.fromEntries(this.preferences.map((pref) => [pref.id, pref.enabled]));
    sessionStorage.setItem(`${NOTIF_PREFS_KEY}_${userId}`, JSON.stringify(payload));
  }
}
