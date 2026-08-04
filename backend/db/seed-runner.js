const { getDb } = require('./sqlite');
const { runTransaction } = require('./transaction');

function setMeta(key, value) {
  getDb()
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, String(value));
}

function getMeta(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function mergeSeedUser(seedUser, runtimeUser) {
  if (!runtimeUser) {
    return seedUser;
  }

  return {
    ...seedUser,
    name: runtimeUser.name ?? seedUser.name,
    phone: runtimeUser.phone ?? seedUser.phone,
    pin: runtimeUser.pin ?? seedUser.pin,
    email: runtimeUser.email ?? seedUser.email,
    tier: runtimeUser.tier ?? seedUser.tier,
    points: runtimeUser.points ?? seedUser.points,
  };
}

function mergeSeedCard(seedCard, runtimeCard) {
  if (!runtimeCard) {
    return seedCard;
  }

  return {
    ...seedCard,
    top_up_enabled: runtimeCard.top_up_enabled ?? seedCard.top_up_enabled,
    is_default_receive: runtimeCard.is_default_receive ?? seedCard.is_default_receive,
    label: runtimeCard.label ?? seedCard.label,
    bank_name: runtimeCard.bank_name ?? seedCard.bank_name,
    account_kind: runtimeCard.account_kind ?? seedCard.account_kind,
  };
}

function normalizeCardDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function insertUser(database, user) {
  database
    .prepare(
      `INSERT INTO users (id, name, phone, pin, tier, points, email)
       VALUES (@id, @name, @phone, @pin, @tier, @points, @email)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         pin = excluded.pin,
         tier = excluded.tier,
         points = excluded.points,
         email = excluded.email`
    )
    .run({
      ...user,
      email: user.email ?? null,
    });
}

function insertCard(database, card) {
  database
    .prepare(
      `INSERT INTO cards (
         id, user_id, card_type, label, card_number, masked_number, cardholder_name,
         expiry_date, balance, credit_limit, top_up_enabled, bank_name, account_kind, is_default_receive
       ) VALUES (
         @id, @user_id, @card_type, @label, @card_number, @masked_number, @cardholder_name,
         @expiry_date, @balance, @credit_limit, @top_up_enabled, @bank_name, @account_kind, @is_default_receive
       )
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         card_type = excluded.card_type,
         label = excluded.label,
         card_number = excluded.card_number,
         masked_number = excluded.masked_number,
         cardholder_name = excluded.cardholder_name,
         expiry_date = excluded.expiry_date,
         balance = excluded.balance,
         credit_limit = excluded.credit_limit,
         top_up_enabled = excluded.top_up_enabled,
         bank_name = excluded.bank_name,
         account_kind = excluded.account_kind,
         is_default_receive = excluded.is_default_receive`
    )
    .run({
      ...card,
      credit_limit: card.credit_limit ?? null,
      bank_name: card.bank_name ?? null,
      account_kind: card.account_kind ?? null,
      top_up_enabled: card.top_up_enabled ? 1 : 0,
      is_default_receive: card.is_default_receive ? 1 : 0,
    });
}

function insertTransaction(database, txn) {
  database
    .prepare(
      `INSERT INTO transactions (
         id, user_id, card_id, merchant, category, subtitle, amount, txn_type, icon, icon_color, occurred_at,
         transfer_direction, counterparty_phone, counterparty_name, transfer_id
       ) VALUES (
         @id, @user_id, @card_id, @merchant, @category, @subtitle, @amount, @txn_type, @icon, @icon_color, @occurred_at,
         @transfer_direction, @counterparty_phone, @counterparty_name, @transfer_id
       )
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         card_id = excluded.card_id,
         merchant = excluded.merchant,
         category = excluded.category,
         subtitle = excluded.subtitle,
         amount = excluded.amount,
         txn_type = excluded.txn_type,
         icon = excluded.icon,
         icon_color = excluded.icon_color,
         occurred_at = excluded.occurred_at,
         transfer_direction = excluded.transfer_direction,
         counterparty_phone = excluded.counterparty_phone,
         counterparty_name = excluded.counterparty_name,
         transfer_id = excluded.transfer_id`
    )
    .run({
      id: txn.id,
      user_id: txn.user_id,
      card_id: txn.card_id,
      merchant: txn.merchant,
      category: txn.category,
      subtitle: txn.subtitle ?? null,
      amount: txn.amount,
      txn_type: txn.txn_type,
      icon: txn.icon ?? null,
      icon_color: txn.icon_color ?? null,
      occurred_at: txn.occurred_at,
      transfer_direction: txn.transfer_direction ?? null,
      counterparty_phone: txn.counterparty_phone ?? null,
      counterparty_name: txn.counterparty_name ?? null,
      transfer_id: txn.transfer_id ?? null,
    });
}

function loadExistingSnapshot(database) {
  return {
    users: database.prepare('SELECT * FROM users').all(),
    cards: database.prepare('SELECT * FROM cards').all(),
    transactions: database.prepare('SELECT * FROM transactions').all(),
    notifications: database.prepare('SELECT * FROM notifications').all(),
  };
}

function seedMerge(data) {
  const database = getDb();
  const { computeCardBalances, OPENING_BALANCES } = require('../seed-data');
  const existing = loadExistingSnapshot(database);

  const seedUserIds = new Set(data.users.map((user) => user.id));
  const mergedUsers = data.users.map((seedUser) => {
    const runtimeUser = existing.users.find((user) => user.id === seedUser.id);
    return mergeSeedUser(seedUser, runtimeUser);
  });
  const extraUsers = existing.users.filter((user) => !seedUserIds.has(user.id));

  const seedIds = new Set(data.cards.map((card) => card.id));
  const seedNumbers = new Set(
    data.cards.map((card) => normalizeCardDigits(card.card_number)).filter(Boolean)
  );
  const preservedCards = existing.cards.filter((card) => {
    if (seedIds.has(card.id)) {
      return false;
    }
    const digits = normalizeCardDigits(card.card_number);
    return digits && !seedNumbers.has(digits);
  });

  const mergedSeedCards = data.cards.map((seedCard) => {
    const runtimeCard = existing.cards.find((card) => card.id === seedCard.id);
    return mergeSeedCard(seedCard, runtimeCard);
  });

  const seedTxnIds = new Set(data.transactions.map((txn) => txn.id));
  const extraTransactions = existing.transactions.filter((txn) => !seedTxnIds.has(txn.id));
  const mergedTransactions = [...data.transactions, ...extraTransactions];

  const seedCardsWithBalances = computeCardBalances(
    mergedSeedCards,
    mergedTransactions,
    OPENING_BALANCES
  );

  runTransaction(database, () => {
    for (const user of [...mergedUsers, ...extraUsers]) {
      insertUser(database, user);
    }

    for (const card of seedCardsWithBalances) {
      insertCard(database, card);
    }

    for (const card of preservedCards) {
      insertCard(database, card);
    }

    for (const txn of mergedTransactions) {
      insertTransaction(database, txn);
    }

    setMeta('seed_version', data.seedVersion ?? 6);
  });
}

function seedReset(data) {
  const database = getDb();
  runTransaction(database, () => {
    database.exec(`
      DELETE FROM notifications;
      DELETE FROM transactions;
      DELETE FROM cards;
      DELETE FROM users;
    `);

    for (const user of data.users) {
      insertUser(database, user);
    }

    for (const card of data.cards) {
      insertCard(database, card);
    }

    for (const txn of data.transactions) {
      insertTransaction(database, txn);
    }

    setMeta('seed_version', data.seedVersion ?? 6);
  });
}

module.exports = {
  seedMerge,
  seedReset,
  getMeta,
  setMeta,
  insertUser,
  insertCard,
  insertTransaction,
};
