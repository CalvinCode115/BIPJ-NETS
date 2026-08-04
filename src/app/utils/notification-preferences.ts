export const NOTIF_PREFS_KEY = 'nets_notif_prefs';

export function isLowBalanceAlertsEnabled(userId: string | null | undefined): boolean {
  if (!userId) {
    return true;
  }

  try {
    const raw = sessionStorage.getItem(`${NOTIF_PREFS_KEY}_${userId}`);
    if (!raw) {
      return true;
    }
    const saved = JSON.parse(raw) as Record<string, boolean>;
    return saved['low_balance'] !== false;
  } catch {
    return true;
  }
}

function lowBalanceDismissKey(userId: string, cardId: string): string {
  return `nets_low_bal_dismiss_${userId}_${cardId}`;
}

export function isLowBalanceDismissed(userId: string, cardId: string): boolean {
  return sessionStorage.getItem(lowBalanceDismissKey(userId, cardId)) === '1';
}

export function dismissLowBalanceReminder(userId: string, cardId: string): void {
  sessionStorage.setItem(lowBalanceDismissKey(userId, cardId), '1');
}

export function clearLowBalanceDismiss(userId: string, cardId: string): void {
  sessionStorage.removeItem(lowBalanceDismissKey(userId, cardId));
}
