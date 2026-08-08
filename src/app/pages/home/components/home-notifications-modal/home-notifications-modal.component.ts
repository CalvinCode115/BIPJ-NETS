import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AppNotification } from '../../../../services/notifications.service';
import {
  formatNotificationAmount,
  formatNotificationSender,
  formatNotificationWhen as formatNotificationWhenUtil,
} from '../../../../utils/notification-display';

@Component({
  selector: 'app-home-notifications-modal',
  templateUrl: './home-notifications-modal.component.html',
  styleUrls: ['./home-notifications-modal.component.scss'],
  standalone: false,
})
export class HomeNotificationsModalComponent {
  @Input() isOpen = false;
  @Input() notifications: AppNotification[] = [];

  @Output() dismissed = new EventEmitter<void>();

  close(): void {
    this.dismissed.emit();
  }

  notificationAmount(entry: AppNotification | null): string | null {
    return formatNotificationAmount(entry);
  }

  notificationSender(entry: AppNotification | null): string {
    return formatNotificationSender(entry);
  }

  formatNotificationWhen(iso: string): string {
    return formatNotificationWhenUtil(iso);
  }
}
