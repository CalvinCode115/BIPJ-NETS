export const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
export const EMAIL_PATTERN = /^[A-Za-z0-9_@.]+@[A-Za-z0-9_.-]+\.[A-Za-z]{2,}$/;
export const PIN_PATTERN = /^\d{6}$/;

export function sanitizeNameInput(value: string): string {
  return value.replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' ');
}

export function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function sanitizeEmailInput(value: string): string {
  return value.replace(/[^A-Za-z0-9_@.]/g, '');
}

export function sanitizePinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function sanitizeExpiryInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function sanitizeCvvInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

/** Force ion-input to display sanitized text (one-way [value] alone does not block letters). */
export function applySanitizedIonInput(event: CustomEvent, sanitized: string): void {
  const ionInput = event.target as { value?: string } | null;
  if (!ionInput) {
    return;
  }

  const current = String(event.detail.value ?? '');
  if (current !== sanitized) {
    ionInput.value = sanitized;
  }
}
