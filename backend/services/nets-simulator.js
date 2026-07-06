/**
 * Simulates NETS card registry lookup and balance retrieval.
 * Any valid 16-digit number works if not already linked; balance is derived from the digits.
 */

const cardUtils = require('./card-utils');
const { clampCreditLimit } = require('./credit-config');

/** Optional demo numbers for presentations — not required for linking. */
const REGISTRY = [
  {
    card_number: '5990899067786689',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    balance: 125.5,
  },
  {
    card_number: '6250123456789012',
    card_type: 'cashcard',
    label: 'NETS CashCard (Transit)',
    balance: 28.9,
  },
  {
    card_number: '4532015112830366',
    card_type: 'others',
    label: 'Linked DBS Debit',
    balance: 245.8,
  },
  {
    card_number: '5500000000000004',
    card_type: 'others',
    label: 'Linked Mastercard Credit',
    balance: 156.4,
    credit_limit: 3000,
  },
];

const MIN_EXPIRY_YEAR = 26;
const MIN_EXPIRY_MONTH = 7;

const DEMO_LINK = {
  expiry: '07/28',
  cvv: '123',
};

const OTHERS_DEMO_CARDHOLDERS = {
  '4532015112830366': 'ALEX TAN',
  '5500000000000004': 'BELINDA HO',
};

function enrichRegistryEntry(entry) {
  const inferred = cardUtils.inferFromLabel(entry.label);
  return {
    ...entry,
    bank_name: inferred.bankName,
    account_kind: inferred.accountKind,
  };
}

function formatRegistryEntry(entry) {
  const enriched = enrichRegistryEntry(entry);
  const requiresCardholder = entry.card_type === 'others';
  const cardholderName = requiresCardholder
    ? OTHERS_DEMO_CARDHOLDERS[entry.card_number] || 'CARDHOLDER'
    : null;

  return {
    cardType: entry.card_type,
    label: entry.label,
    cardNumber: formatCardNumber(entry.card_number),
    balance: entry.balance,
    creditLimit: entry.credit_limit ? clampCreditLimit(entry.credit_limit) : null,
    expiryDate: DEMO_LINK.expiry,
    cvv: DEMO_LINK.cvv,
    cardholderName,
    requiresCardholder,
    bankName: enriched.bank_name,
    accountKind: enriched.account_kind,
  };
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCardNumber(digits) {
  const clean = normalizeDigits(digits).slice(0, 16);
  return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`;
}

function maskCardNumber(digits) {
  const clean = normalizeDigits(digits);
  if (clean.length < 8) {
    return clean;
  }
  return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function digitHash(digits) {
  return normalizeDigits(digits)
    .split('')
    .reduce((sum, digit) => sum + parseInt(digit, 10), 0);
}

function hashToRange(hash, min, max, salt = 1) {
  const span = max - min;
  if (span <= 0) {
    return round2(min);
  }
  return round2(min + ((hash * salt) % Math.round(span * 100)) / 100);
}

function isExpiryValid(expiry) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    return false;
  }

  const [monthPart, yearPart] = expiry.split('/');
  const month = parseInt(monthPart, 10);
  const year = parseInt(yearPart, 10);

  if (year > MIN_EXPIRY_YEAR) {
    return true;
  }

  return year === MIN_EXPIRY_YEAR && month >= MIN_EXPIRY_MONTH;
}

function validateLinkRequest(payload) {
  const cardType = payload.cardType;
  if (!['prepaid', 'cashcard', 'others'].includes(cardType)) {
    return { ok: false, error: 'Invalid card type.' };
  }

  const digits = normalizeDigits(payload.cardNumber);
  const cardholderName = String(payload.cardholderName || '').trim().toUpperCase();
  const expiry = String(payload.expiryDate || '').trim();
  const cvv = String(payload.cvv || '').trim();

  if (digits.length !== 16) {
    return { ok: false, error: 'Enter a valid 16-digit card number.' };
  }

  if (cardType === 'others') {
    if (cardholderName.length < 2 || !/^[A-Z\s]+$/.test(cardholderName)) {
      return { ok: false, error: 'Enter a valid name using letters only.' };
    }
  }

  if (!isExpiryValid(expiry)) {
    return { ok: false, error: 'Expiry must be July 2026 or later (MM/YY).' };
  }

  if (!/^\d{3}$/.test(cvv)) {
    return { ok: false, error: 'CVV must be exactly 3 digits.' };
  }

  return {
    ok: true,
    data: {
      cardType,
      digits,
      cardNumber: formatCardNumber(digits),
      maskedNumber: maskCardNumber(digits),
      cardholderName,
      expiryDate: expiry,
      cvv,
    },
  };
}

function lookupRegistry(digits, cardType) {
  return REGISTRY.find(
    (entry) => entry.card_number === digits && entry.card_type === cardType
  );
}

function simulateCreditLimit(digits) {
  const hash = digitHash(digits);
  return clampCreditLimit(1000 + ((hash * 47) % 2001));
}

function simulateBalance(digits, cardType, accountKind = 'debit') {
  const hash = digitHash(digits);

  if (cardType === 'prepaid') {
    return hashToRange(hash, 10, 500, 13.7);
  }

  if (cardType === 'cashcard') {
    return hashToRange(hash, 0, 200, 3.1);
  }

  if (accountKind === 'credit') {
    const limit = simulateCreditLimit(digits);
    const availablePct = 0.15 + ((hash * 11) % 76) / 100;
    return round2(limit * availablePct);
  }

  return hashToRange(hash, 50, 2000, 7.3);
}

function resolveBalance(digits, cardType, accountKind = 'debit') {
  const registryHit = lookupRegistry(digits, cardType);
  if (registryHit) {
    return {
      balance: registryHit.balance,
      label: registryHit.label,
      source: 'nets_registry',
      creditLimit: registryHit.credit_limit ? clampCreditLimit(registryHit.credit_limit) : null,
    };
  }

  const isCredit = cardType === 'others' && accountKind === 'credit';
  const creditLimit = isCredit ? simulateCreditLimit(digits) : null;

  return {
    balance: simulateBalance(digits, cardType, accountKind),
    label: defaultLabel(cardType, accountKind),
    source: 'nets_simulated',
    creditLimit,
  };
}

function defaultLabel(cardType, accountKind = 'debit') {
  if (cardType === 'prepaid') {
    return 'NETS Prepaid';
  }
  if (cardType === 'cashcard') {
    return 'NETS CashCard';
  }
  return accountKind === 'credit' ? 'Linked Bank Credit' : 'Linked Bank Debit';
}

function buildLinkResult(payload, userName) {
  const validation = validateLinkRequest(payload);
  if (!validation.ok) {
    return validation;
  }

  const { cardType, digits, cardNumber, maskedNumber, cardholderName, expiryDate } = validation.data;

  let bankName = payload.bankName ? String(payload.bankName).trim() : null;
  let accountKind =
    payload.accountKind === 'credit' ? 'credit' : payload.accountKind === 'debit' ? 'debit' : 'debit';

  const resolved = resolveBalance(digits, cardType, cardType === 'others' ? accountKind : 'debit');
  const holder =
    cardType === 'others' ? cardholderName : String(userName || 'CARDHOLDER').toUpperCase();

  let label = resolved.label;

  if (cardType === 'others') {
    if (payload.bankName || payload.accountKind) {
      bankName = bankName || 'Bank';
      label = cardUtils.buildLinkedLabel(bankName, accountKind);
    } else {
      const inferred = cardUtils.inferFromLabel(resolved.label);
      bankName = bankName || inferred.bankName;
      accountKind = accountKind || inferred.accountKind;
    }
  }

  return {
    ok: true,
    source: resolved.source,
    card: {
      cardType,
      label,
      cardNumber,
      maskedNumber,
      cardholderName: holder,
      expiryDate,
      balance: resolved.balance,
      creditLimit: resolved.creditLimit ? clampCreditLimit(resolved.creditLimit) : null,
      topUpEnabled: cardType !== 'others',
      bankName: bankName || null,
      accountKind: cardType === 'others' ? accountKind : null,
      isDefaultReceive: Boolean(payload.isDefaultReceive),
    },
  };
}

module.exports = {
  REGISTRY,
  validateLinkRequest,
  resolveBalance,
  buildLinkResult,
  formatCardNumber,
  formatRegistryEntry,
  maskCardNumber,
  normalizeDigits,
};
