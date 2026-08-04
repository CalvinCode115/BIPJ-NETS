export function sanitizeDecimalAmountInput(raw: string): { text: string; amount: number } {
  let cleaned = raw.replace(/[^\d.]/g, '');

  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1) {
    const whole = cleaned.slice(0, dotIndex);
    const fraction = cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
    cleaned = `${whole}.${fraction}`;
  }

  if (cleaned.startsWith('.')) {
    cleaned = `0${cleaned}`;
  }

  if (!cleaned || cleaned === '.') {
    return { text: cleaned === '.' ? '0.' : '', amount: 0 };
  }

  let amount = parseFloat(cleaned);
  if (!Number.isFinite(amount) || amount < 0) {
    amount = 0;
    cleaned = '';
  }

  return { text: cleaned, amount };
}

export function sanitizeIntegerAmountInput(raw: string): { text: string; amount: number } {
  let cleaned = raw.replace(/\D/g, '');
  if (!cleaned) {
    return { text: '', amount: 0 };
  }

  let amount = parseInt(cleaned, 10);
  if (!Number.isFinite(amount) || amount < 0) {
    return { text: '', amount: 0 };
  }

  cleaned = String(amount);
  return { text: cleaned, amount };
}
