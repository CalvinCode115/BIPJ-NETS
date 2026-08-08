/**
 * Card metadata and payment eligibility helpers.
 */

function getSgd(card) {
  const n = normalizeCardRow(card) || card;
  if (!n) return 0;
  const sgd = n.multi_currency?.SGD ?? n.balance;
  return Math.max(0, Number(sgd) || 0);
}

function getAvailableFunds(card) {
  return getSgd(card);
}

function applyDebit(card, amount) {
  const normalized = normalizeCardRow(card);
  const current = getSgd(normalized);
  const delta = -Math.abs(amount);
  return Math.round(Math.max(0, current + delta) * 100) / 100;
}

function applyCredit(card, amount) {
  const normalized = normalizeCardRow(card);
  if (normalized.card_type === 'others' && isCreditCard(normalized)) {
    return getSgd(normalized);
  }
  return Math.round((getSgd(normalized) + Math.abs(amount)) * 100) / 100;
}

function inferFromLabel(label) {
  const text = String(label || '').toLowerCase();
  const accountKind = text.includes('credit') ? 'credit' : 'debit';

  const banks = [
    { key: 'dbs', name: 'DBS' },
    { key: 'posb', name: 'POSB' },
    { key: 'uob', name: 'UOB' },
    { key: 'ocbc', name: 'OCBC' },
    { key: 'maybank', name: 'Maybank' },
    { key: 'hsbc', name: 'HSBC' },
    { key: 'citi', name: 'Citi' },
    { key: 'visa', name: 'Visa' },
    { key: 'mastercard', name: 'Mastercard' },
  ];

  const bankHit = banks.find((entry) => text.includes(entry.key));
  const bankName = bankHit?.name ?? 'Bank';

  return { bankName, accountKind };
}

function buildLinkedLabel(bankName, accountKind) {
  const kindLabel = accountKind === 'credit' ? 'Credit' : 'Debit';
  return `Linked ${bankName} ${kindLabel}`;
}

function normalizeCardRow(row) {
  if (!row || row.card_type !== 'others') {
    return row;
  }

  const inferred = inferFromLabel(row.label);
  return {
    ...row,
    bank_name: row.bank_name || inferred.bankName,
    account_kind: row.account_kind || inferred.accountKind,
    is_default_receive: Boolean(row.is_default_receive),
  };
}

function isDebitCard(card) {
  const normalized = normalizeCardRow(card);
  return normalized.card_type === 'others' && normalized.account_kind === 'debit';
}

function isCreditCard(card) {
  const normalized = normalizeCardRow(card);
  return normalized.card_type === 'others' && normalized.account_kind === 'credit';
}

function canPayFrom(card) {
  if (!card) {
    return false;
  }
  if (card.card_type === 'cashcard') {
    return false;
  }
  return ['prepaid', 'others'].includes(card.card_type);
}

function canReceiveTransfer(card) {
  if (!card) {
    return false;
  }
  if (card.card_type === 'prepaid') {
    return true;
  }
  return isDebitCard(card);
}

function getPrimaryPrepaid(cards) {
  return cards.find((c) => c.card_type === 'prepaid') || null;
}

function resolveReceiveCard(cards) {
  const normalized = cards.map(normalizeCardRow);

  const defaultDebit =
    normalized.find((c) => c.card_type === 'others' && c.is_default_receive && isDebitCard(c)) ||
    normalized.find((c) => c.card_type === 'others' && isDebitCard(c)) ||
    null;

  if (defaultDebit) {
    return {
      card: defaultDebit,
      mode: 'debit',
      label: `${defaultDebit.bank_name} Debit · ${defaultDebit.masked_number}`,
    };
  }

  const hasCreditOnly =
    normalized.some((c) => c.card_type === 'others') &&
    !normalized.some((c) => c.card_type === 'others' && isDebitCard(c));

  const prepaid = getPrimaryPrepaid(normalized);
  if (hasCreditOnly && prepaid) {
    return {
      card: prepaid,
      mode: 'prepaid_fallback',
      label: `${prepaid.label} · ${prepaid.masked_number}`,
    };
  }

  if (prepaid) {
    return {
      card: prepaid,
      mode: 'prepaid',
      label: `${prepaid.label} · ${prepaid.masked_number}`,
    };
  }

  return null;
}

function hasSufficientFunds(card, amount) {
  return getAvailableFunds(card) >= amount;
}

function formatPayFromLabel(card) {
  const normalized = normalizeCardRow(card);
  if (normalized.card_type === 'others') {
    const kind = normalized.account_kind === 'credit' ? 'Credit' : 'Debit';
    return `${normalized.bank_name} ${kind} · ${normalized.masked_number}`;
  }
  return `${normalized.label} · ${normalized.masked_number}`;
}

module.exports = {
  inferFromLabel,
  buildLinkedLabel,
  normalizeCardRow,
  isDebitCard,
  isCreditCard,
  canPayFrom,
  canReceiveTransfer,
  resolveReceiveCard,
  getPrimaryPrepaid,
  getAvailableFunds,
  hasSufficientFunds,
  applyDebit,
  applyCredit,
  formatPayFromLabel,
};
