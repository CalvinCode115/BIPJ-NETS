import { AppNotification } from '../services/notifications.service';

/** Format notification amount as `$12.00` or `100 pts`. */
export function formatNotificationAmount(entry: AppNotification | null): string | null {
  if (!entry) {
    return null;
  }
  const amount = Number(entry.meta?.['amount']);
  if (Number.isFinite(amount)) {
    if (entry.type === 'points_received' || entry.meta?.['unit'] === 'pts') {
      return `${Math.round(amount).toLocaleString('en-SG')} pts`;
    }
    return `$${amount.toFixed(2)}`;
  }
  const ptsMatch = entry.message.match(/([\d,]+)\s*pts/i);
  if (ptsMatch) {
    return `${ptsMatch[1]} pts`;
  }
  const match = entry.message.match(/\$([\d,]+\.\d{2})/);
  return match ? `$${match[1]}` : null;
}

/** Masked sender name from meta or message. */
export function formatNotificationSender(entry: AppNotification | null): string {
  if (!entry) {
    return '';
  }
  const fromMeta = entry.meta?.['fromName'];
  if (typeof fromMeta === 'string' && fromMeta.trim()) {
    return fromMeta.trim();
  }
  const match = entry.message.match(/^(.+?)\s+sent you/i);
  return match ? match[1].trim() : 'Someone';
}

/** Singapore-local date/time for notification rows. */
export function formatNotificationWhen(iso: string): string {
  const timestampHasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  const date = new Date(timestampHasTimezone ? iso : `${iso}+08:00`);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
