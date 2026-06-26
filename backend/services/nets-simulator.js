/**
 * Simulates NETS card registry lookup and balance retrieval.
 * In production this would call NETS wallet APIs after card verification.
 */

const cardUtils = require('./card-utils');
const { clampCreditLimit } = require('./credit-config');

function enrichRegistryEntry(entry) {
  const inferred = cardUtils.inferFromLabel(entry.label);
  return {
    ...entry,
    bank_name: inferred.bankName,
    account_kind: inferred.accountKind,
  };
}

const REGISTRY = [
  // PREPAID — 5 demo cards
  {
    card_number: '5990899067786689',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    balance: 125.5,
  },
  {
    card_number: '6011000000000004',
    card_type: 'prepaid',
    label: 'NETS Prepaid (Student)',
    balance: 42.0,
  },
  {
    card_number: '6011000000000005',
    card_type: 'prepaid',
    label: 'NETS Prepaid (Travel)',
    balance: 380.75,
  },
  {
    card_number: '6011000000000006',
    card_type: 'prepaid',
    label: 'NETS Prepaid (Premium)',
    balance: 485.0,
  },
  {
    card_number: '6011000000000007',
    card_type: 'prepaid',
    label: 'NETS Prepaid (Starter)',
    balance: 15.0,
  },
  {
    card_number: '6011000000000008',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    balance: 55.0,
  },
  {
    card_number: '6011000000000009',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    balance: 210.0,
  },
  {
    card_number: '6011000000000010',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    balance: 920.0,
  },
  {
    card_number: '6011000000000011',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    balance: 175.25,
  },
  {
    card_number: '6011000000000012',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    balance: 8.5,
  },
  // CASHCARD — 10 demo cards
  {
    card_number: '6250123456789012',
    card_type: 'cashcard',
    label: 'NETS CashCard (Transit)',
    balance: 28.9,
  },
  {
    card_number: '6250987654321098',
    card_type: 'cashcard',
    label: 'NETS CashCard (Motoring)',
    balance: 67.3,
  },
  {
    card_number: '6250111122223333',
    card_type: 'cashcard',
    label: 'NETS CashCard (FlashPay)',
    balance: 0,
  },
  {
    card_number: '6250445566778899',
    card_type: 'cashcard',
    label: 'NETS CashCard (Family)',
    balance: 203.15,
  },
  {
    card_number: '5283778878921289',
    card_type: 'cashcard',
    label: 'NETS CashCard',
    balance: 112.5,
  },
  {
    card_number: '6250555666777888',
    card_type: 'cashcard',
    label: 'NETS CashCard',
    balance: 45.0,
  },
  {
    card_number: '6250666777888999',
    card_type: 'cashcard',
    label: 'NETS CashCard',
    balance: 18.6,
  },
  {
    card_number: '6250777888999000',
    card_type: 'cashcard',
    label: 'NETS CashCard',
    balance: 92.4,
  },
  {
    card_number: '6250888999000111',
    card_type: 'cashcard',
    label: 'NETS CashCard',
    balance: 134.75,
  },
  {
    card_number: '6250999000111222',
    card_type: 'cashcard',
    label: 'NETS CashCard',
    balance: 56.2,
  },
  // OTHERS — 10 debit + 10 credit demo cards
  {
    card_number: '4111111111111111',
    card_type: 'others',
    label: 'Linked Visa Debit',
    balance: 0,
  },
  {
    card_number: '4532015112830366',
    card_type: 'others',
    label: 'Linked DBS Debit',
    balance: 245.8,
  },
  {
    card_number: '5213240000000000',
    card_type: 'others',
    label: 'Linked UOB Debit',
    balance: 312.0,
  },
  {
    card_number: '4532123456789012',
    card_type: 'others',
    label: 'Linked POSB Debit',
    balance: 188.2,
  },
  {
    card_number: '4532987654321098',
    card_type: 'others',
    label: 'Linked Maybank Debit',
    balance: 421.5,
  },
  {
    card_number: '4111222233334444',
    card_type: 'others',
    label: 'Linked HSBC Debit',
    balance: 76.9,
  },
  {
    card_number: '5213567890123456',
    card_type: 'others',
    label: 'Linked Citi Debit',
    balance: 502.3,
  },
  {
    card_number: '5213789012345678',
    card_type: 'others',
    label: 'Linked UOB Debit (Premium)',
    balance: 890.0,
  },
  {
    card_number: '5500000000000004',
    card_type: 'others',
    label: 'Linked Mastercard Credit',
    balance: 156.4,
    credit_limit: 3000,
  },
  {
    card_number: '4917610000000000',
    card_type: 'others',
    label: 'Linked OCBC Credit',
    balance: 2450,
    credit_limit: 3000,
  },
  {
    card_number: '5500123456789012',
    card_type: 'others',
    label: 'Linked DBS Credit',
    balance: 680,
    credit_limit: 3000,
  },
  {
    card_number: '4917123456789012',
    card_type: 'others',
    label: 'Linked OCBC Credit (Platinum)',
    balance: 420,
    credit_limit: 3000,
  },
  {
    card_number: '5500987654321098',
    card_type: 'others',
    label: 'Linked UOB Credit',
    balance: 920,
    credit_limit: 3000,
  },
  {
    card_number: '4532111122223333',
    card_type: 'others',
    label: 'Linked Maybank Credit',
    balance: 1100,
    credit_limit: 3000,
  },
  {
    card_number: '5500445566778899',
    card_type: 'others',
    label: 'Linked Citi Credit',
    balance: 750,
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
  '4111111111111111': 'ADAM LIM',
  '5500000000000004': 'BELINDA HO',
  '4532015112830366': 'ALEX TAN',
  '4917610000000000': 'SARAH LIM',
  '5213240000000000': 'JUN JIE GOH',
  '4532123456789012': 'MEI LING TAN',
  '4532987654321098': 'RAJ KUMAR',
  '4111222233334444': 'JASON ONG',
  '5213567890123456': 'NURUL AZIZ',
  '5213789012345678': 'DAVID CHUA',
  '5500123456789012': 'EMILY KOH',
  '4917123456789012': 'MICHAEL GOH',
  '5500987654321098': 'PRIYA NAIR',
  '4532111122223333': 'WEI MING LEE',
  '5500445566778899': 'SITI AMINAH',
};

function formatRegistryEntry(entry) {
  const enriched = enrichRegistryEntry(entry);
  const requiresCardholder = entry.card_type === 'others';
  const cardholderName = requiresCardholder
    ? OTHERS_DEMO_CARDHOLDERS[entry.card_number] || 'ADAM LIM'
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

function simulateBalance(digits, cardType) {
  const hash = digits.split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0);

  if (cardType === 'others') {
    return round2(((hash * 7.3) % 499) + 1);
  }

  if (cardType === 'prepaid') {
    return round2(((hash * 13.7) % 499) + 1);
  }

  return round2(((hash * 3.1) % 499) + 1);
}

function resolveBalance(digits, cardType) {
  const registryHit = lookupRegistry(digits, cardType);
  if (registryHit) {
    return {
      balance: registryHit.balance,
      label: registryHit.label,
      source: 'nets_registry',
      creditLimit: registryHit.credit_limit ? clampCreditLimit(registryHit.credit_limit) : null,
    };
  }

  return {
    balance: simulateBalance(digits, cardType),
    label: defaultLabel(cardType),
    source: 'nets_simulated',
    creditLimit: null,
  };
}

function defaultLabel(cardType) {
  const labels = {
    prepaid: 'NETS Prepaid',
    cashcard: 'NETS CashCard',
    others: 'Linked Bank Card',
  };
  return labels[cardType];
}

function buildLinkResult(payload, userName) {
  const validation = validateLinkRequest(payload);
  if (!validation.ok) {
    return validation;
  }

  const { cardType, digits, cardNumber, maskedNumber, cardholderName, expiryDate } = validation.data;
  const resolved = resolveBalance(digits, cardType);
  const holder =
    cardType === 'others' ? cardholderName : String(userName || 'CARDHOLDER').toUpperCase();

  let bankName = payload.bankName ? String(payload.bankName).trim() : null;
  let accountKind = payload.accountKind === 'credit' ? 'credit' : payload.accountKind === 'debit' ? 'debit' : null;
  let label = resolved.label;

  if (cardType === 'others') {
    const inferred = cardUtils.inferFromLabel(resolved.label);
    bankName = bankName || inferred.bankName;
    accountKind = accountKind || inferred.accountKind;
    if (payload.bankName || payload.accountKind) {
      label = cardUtils.buildLinkedLabel(bankName, accountKind);
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
      accountKind: accountKind || null,
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
