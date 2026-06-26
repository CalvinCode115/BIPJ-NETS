import { maskDisplayName } from './display-name';

export interface TransferCounterparty {
  direction: 'from' | 'to';
  phone?: string;
  name?: string;
}

export interface TransferDisplayInput {
  merchant: string;
  category?: string;
  subtitle: string;
  counterparty?: TransferCounterparty | null;
}

function normalizePhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

function formatPhone(digits: string): string {
  const clean = normalizePhoneDigits(digits);
  if (clean.length !== 8) {
    return '';
  }
  return `+65 ${clean.slice(0, 4)} ${clean.slice(4)}`;
}

function parseLegacySubtitle(subtitle: string): TransferCounterparty | null {
  const match = subtitle.match(/^(From|To)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const direction = match[1].toLowerCase() as 'from' | 'to';
  const value = match[2].trim();
  const digits = normalizePhoneDigits(value);

  if (digits.length === 8) {
    return { direction, phone: formatPhone(digits) };
  }

  return { direction, name: value };
}

export function isTransferTransaction(txn: TransferDisplayInput): boolean {
  return (
    txn.category === 'Transfer' ||
    txn.merchant === 'PayNow Transfer' ||
    txn.merchant === 'P2P Transfer'
  );
}

export function resolveTransferCounterparty(txn: TransferDisplayInput): TransferCounterparty | null {
  if (!isTransferTransaction(txn)) {
    return null;
  }

  if (txn.counterparty?.direction) {
    return txn.counterparty;
  }

  return parseLegacySubtitle(txn.subtitle);
}

export function formatCounterpartyLine(
  direction: 'from' | 'to',
  name?: string,
  phone?: string
): string {
  const directionLabel = direction === 'from' ? 'From' : 'To';
  const phoneDigits = phone ? normalizePhoneDigits(phone) : '';
  const formattedPhone = phoneDigits ? formatPhone(phoneDigits) : '';

  if (name && formattedPhone) {
    return `${directionLabel} ${maskDisplayName(name)} · ${formattedPhone}`;
  }

  if (name) {
    return `${directionLabel} ${maskDisplayName(name)}`;
  }

  if (formattedPhone) {
    return `${directionLabel} ${formattedPhone}`;
  }

  return directionLabel;
}

export function formatTransferCounterpartyLine(txn: TransferDisplayInput): string | null {
  const counterparty = resolveTransferCounterparty(txn);
  if (!counterparty) {
    return null;
  }

  return formatCounterpartyLine(counterparty.direction, counterparty.name, counterparty.phone);
}

export function formatTransactionMeta(txn: TransferDisplayInput): string {
  const transferLine = formatTransferCounterpartyLine(txn);
  if (transferLine) {
    return transferLine;
  }

  return txn.subtitle || txn.category || '';
}

export function formatTransferSuccessMessage(
  amount: number,
  toUser: { name: string; phone?: string }
): string {
  const counterparty = formatCounterpartyLine('to', toUser.name, toUser.phone);
  return `Transferred $${amount.toFixed(2)} ${counterparty.replace(/^To/, 'to')}.`;
}
