const { buildAllTransactions } = require('./seed-transactions');

/** Balances at start of sample period (Feb 2026). Final balance = opening + sum(transactions). */
const OPENING_BALANCES = {
  card_prepaid_1: 95,
  card_cashcard_1: 45,
  card_uob_1: 1820,
  card_prepaid_2: 110,
  card_dbs_2: 1650,
  card_ocbc_credit_2: 2450,
  card_prepaid_3: 88,
  card_visa_3: 1420,
  card_prepaid_4: 92,
  card_dbs_4: 1980,
};

function roundMoney(value) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function computeCardBalances(cards, transactions, openingBalances) {
  const totals = {};
  cards.forEach((card) => {
    totals[card.id] = openingBalances[card.id] ?? 0;
  });

  transactions.forEach((txn) => {
    if (Object.prototype.hasOwnProperty.call(totals, txn.card_id)) {
      totals[txn.card_id] += txn.amount;
    }
  });

  return cards.map((card) => ({
    ...card,
    balance: roundMoney(totals[card.id]),
  }));
}

const RAW_CARDS = [
  {
    id: 'card_prepaid_1',
    user_id: 'user_1',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    card_number: '1234567890125678',
    masked_number: '1234 **** **** 5678',
    cardholder_name: 'ALEX TAN',
    expiry_date: '12/28',
    top_up_enabled: 0,
    is_default_receive: 0,
  },
  {
    id: 'card_cashcard_1',
    user_id: 'user_1',
    card_type: 'cashcard',
    label: 'NETS CashCard',
    card_number: '5283778878921289',
    masked_number: '5283 **** **** 1289',
    cardholder_name: 'ALEX TAN',
    expiry_date: '08/28',
    top_up_enabled: 0,
    is_default_receive: 0,
  },
  {
    id: 'card_uob_1',
    user_id: 'user_1',
    card_type: 'others',
    label: 'Linked UOB Debit',
    card_number: '5213240000000000',
    masked_number: '5213 **** **** 0000',
    cardholder_name: 'ALEX TAN',
    expiry_date: '12/27',
    top_up_enabled: 0,
    bank_name: 'UOB',
    account_kind: 'debit',
    is_default_receive: 1,
  },
  {
    id: 'card_prepaid_2',
    user_id: 'user_2',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    card_number: '5678901234567890',
    masked_number: '5678 **** **** 7890',
    cardholder_name: 'SARAH LIM',
    expiry_date: '09/27',
    top_up_enabled: 0,
    is_default_receive: 0,
  },
  {
    id: 'card_dbs_2',
    user_id: 'user_2',
    card_type: 'others',
    label: 'Linked DBS Debit',
    card_number: '4532015112830366',
    masked_number: '4532 **** **** 0366',
    cardholder_name: 'SARAH LIM',
    expiry_date: '08/29',
    top_up_enabled: 0,
    bank_name: 'DBS',
    account_kind: 'debit',
    is_default_receive: 1,
  },
  {
    id: 'card_ocbc_credit_2',
    user_id: 'user_2',
    card_type: 'others',
    label: 'Linked OCBC Credit',
    card_number: '4917610000000000',
    masked_number: '4917 **** **** 0000',
    cardholder_name: 'SARAH LIM',
    expiry_date: '12/33',
    credit_limit: 3000,
    top_up_enabled: 0,
    bank_name: 'OCBC',
    account_kind: 'credit',
    is_default_receive: 0,
  },
  {
    id: 'card_prepaid_3',
    user_id: 'user_3',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    card_number: '6011000000000006',
    masked_number: '6011 **** **** 0006',
    cardholder_name: 'CHENG WEN MAO',
    expiry_date: '07/28',
    top_up_enabled: 0,
    is_default_receive: 0,
  },
  {
    id: 'card_visa_3',
    user_id: 'user_3',
    card_type: 'others',
    label: 'Linked Visa Debit',
    card_number: '4111111111111111',
    masked_number: '4111 **** **** 1111',
    cardholder_name: 'CHENG WEN MAO',
    expiry_date: '12/28',
    top_up_enabled: 0,
    bank_name: 'Visa',
    account_kind: 'debit',
    is_default_receive: 1,
  },
  {
    id: 'card_prepaid_4',
    user_id: 'user_4',
    card_type: 'prepaid',
    label: 'NETS Prepaid',
    card_number: '6011000000000008',
    masked_number: '6011 **** **** 0008',
    cardholder_name: 'ADAM LIEW',
    expiry_date: '11/28',
    top_up_enabled: 0,
    is_default_receive: 0,
  },
  {
    id: 'card_dbs_4',
    user_id: 'user_4',
    card_type: 'others',
    label: 'Linked DBS Debit',
    card_number: '4532015112830444',
    masked_number: '4532 **** **** 4444',
    cardholder_name: 'ADAM LIEW',
    expiry_date: '09/29',
    top_up_enabled: 0,
    bank_name: 'DBS',
    account_kind: 'debit',
    is_default_receive: 1,
  },
];

const transactions = buildAllTransactions();
const cards = computeCardBalances(RAW_CARDS, transactions, OPENING_BALANCES);

module.exports = {
  seedVersion: 7,
  users: [
    {
      id: 'user_1',
      name: 'Alex Tan',
      phone: '+65 9123 4567',
      pin: '123456',
      tier: 'Gold Tier',
      points: 3820,
    },
    {
      id: 'user_2',
      name: 'Sarah Lim',
      phone: '+65 8765 4321',
      pin: '123456',
      tier: 'Silver Tier',
      points: 2150,
    },
    {
      id: 'user_3',
      name: 'Cheng Wen Mao',
      phone: '+65 8068 0505',
      pin: '123456',
      tier: 'Bronze Tier',
      points: 890,
    },
    {
      id: 'user_4',
      name: 'Adam Liew',
      phone: '+65 8468 8831',
      pin: '123456',
      tier: 'Silver Tier',
      points: 1640,
    },
  ],
  cards,
  transactions,
  computeCardBalances,
  OPENING_BALANCES,
};
