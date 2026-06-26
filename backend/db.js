const period = require('./services/period');
const { getDb } = require('./db/sqlite');
const { runTransaction } = require('./db/transaction');
const { seedMerge, seedReset, getMeta, insertUser, insertCard, insertTransaction } = require('./db/seed-runner');
const { LOW_BALANCE_THRESHOLD } = require('./services/wallet-config');

function initialize() {
  getDb();
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function phoneSuffix(phone) {
  const digits = normalizePhone(phone);
  return digits.length >= 8 ? digits.slice(-8) : digits;
}

function normalizeCardDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function parseNotificationRow(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    read: Boolean(row.read),
    meta: row.meta ? JSON.parse(row.meta) : null,
  };
}

function readDb() {
  const database = getDb();
  return {
    users: database.prepare('SELECT * FROM users').all(),
    cards: database.prepare('SELECT * FROM cards').all(),
    transactions: database.prepare('SELECT * FROM transactions').all(),
    notifications: database.prepare('SELECT * FROM notifications').all().map(parseNotificationRow),
    seedVersion: Number(getMeta('seed_version', 0)) || 0,
  };
}

function getUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY name').all();
}

function getUser(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
}

function findUserByPhone(phone) {
  const suffix = phoneSuffix(phone);
  return getUsers().find((user) => phoneSuffix(user.phone) === suffix) || null;
}

function getCards(userId, cardType) {
  const database = getDb();
  let rows;

  if (cardType) {
    rows = database
      .prepare('SELECT * FROM cards WHERE user_id = ? AND card_type = ? ORDER BY card_type, label')
      .all(userId, cardType);
  } else {
    rows = database
      .prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY card_type, label')
      .all(userId);
  }

  return rows.map(syncAutoTopUpPreference);
}

function findLinkedCardByNumber(userId, cardNumberDigits) {
  return (
    getDb()
      .prepare('SELECT * FROM cards WHERE user_id = ?')
      .all(userId)
      .find((card) => normalizeCardDigits(card.card_number) === cardNumberDigits) || null
  );
}

function findAnyLinkedCardByNumber(cardNumberDigits) {
  return (
    getDb()
      .prepare('SELECT * FROM cards')
      .all()
      .find((card) => normalizeCardDigits(card.card_number) === cardNumberDigits) || null
  );
}

function addCard(card) {
  insertCard(getDb(), card);
  return card;
}

function getCardById(userId, cardId) {
  const row = getDb().prepare('SELECT * FROM cards WHERE user_id = ? AND id = ?').get(userId, cardId) || null;
  return row ? syncAutoTopUpPreference(row) : null;
}

function getTransactions(userId, filters = {}) {
  let rows = getDb().prepare('SELECT * FROM transactions WHERE user_id = ?').all(userId);

  if (filters.cardId) {
    rows = rows.filter((row) => row.card_id === filters.cardId);
  } else if (filters.cardType) {
    const cardIds = new Set(getCards(userId, filters.cardType).map((card) => card.id));
    rows = rows.filter((row) => cardIds.has(row.card_id));
  }

  if (filters.category && filters.category !== 'All') {
    rows = rows.filter((row) => row.category === filters.category);
  }

  if (filters.type === 'income') {
    rows = rows.filter((row) => row.amount > 0);
  } else if (filters.type === 'expenditure') {
    rows = rows.filter((row) => row.amount < 0);
  }

  if (filters.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter(
      (row) => row.merchant.toLowerCase().includes(term) || row.category.toLowerCase().includes(term)
    );
  }

  if (filters.month && filters.year) {
    const month = parseInt(filters.month, 10);
    const year = parseInt(filters.year, 10);
    rows = rows.filter((row) => {
      const date = period.parseOccurredAt(row.occurred_at);
      return date.getMonth() + 1 === month && date.getFullYear() === year;
    });
  }

  return rows.sort(
    (a, b) => period.parseOccurredAt(b.occurred_at) - period.parseOccurredAt(a.occurred_at)
  );
}

function addTransaction(transaction) {
  insertTransaction(getDb(), transaction);
  return transaction;
}

function syncAutoTopUpPreference(cardRow) {
  if (!cardRow || (cardRow.card_type !== 'prepaid' && cardRow.card_type !== 'cashcard')) {
    return cardRow;
  }

  const enabled = cardRow.balance < LOW_BALANCE_THRESHOLD ? 1 : 0;
  if (Number(cardRow.top_up_enabled) !== enabled) {
    getDb().prepare('UPDATE cards SET top_up_enabled = ? WHERE id = ?').run(enabled, cardRow.id);
    return getDb().prepare('SELECT * FROM cards WHERE id = ?').get(cardRow.id);
  }

  return cardRow;
}

function updateCardBalance(cardId, delta) {
  const database = getDb();
  const card = database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return null;
  }

  const balance = Math.round(Math.max(0, card.balance + delta) * 100) / 100;
  database.prepare('UPDATE cards SET balance = ? WHERE id = ?').run(balance, cardId);
  const updated = database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  return syncAutoTopUpPreference(updated);
}

function setCardBalance(cardId, balance) {
  const database = getDb();
  const card = database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  if (!card) {
    return null;
  }

  const nextBalance = Math.round(Math.max(0, balance) * 100) / 100;
  database.prepare('UPDATE cards SET balance = ? WHERE id = ?').run(nextBalance, cardId);
  const updated = database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  return syncAutoTopUpPreference(updated);
}

function clearDefaultReceive(userId) {
  getDb().prepare('UPDATE cards SET is_default_receive = 0 WHERE user_id = ?').run(userId);
}

function setDefaultReceiveCard(userId, cardId) {
  const database = getDb();
  const target = database.prepare('SELECT * FROM cards WHERE user_id = ? AND id = ?').get(userId, cardId);
  if (!target) {
    return null;
  }

  runTransaction(database, () => {
    database.prepare('UPDATE cards SET is_default_receive = 0 WHERE user_id = ?').run(userId);
    database.prepare('UPDATE cards SET is_default_receive = 1 WHERE id = ?').run(cardId);
  });

  return database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
}

function addUser(user) {
  insertUser(getDb(), user);
  return user;
}

function updateUserPin(userId, pin) {
  const database = getDb();
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return null;
  }

  database.prepare('UPDATE users SET pin = ? WHERE id = ?').run(pin, userId);
  return database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function deleteCard(userId, cardId) {
  const database = getDb();
  const card = database.prepare('SELECT * FROM cards WHERE user_id = ? AND id = ?').get(userId, cardId);
  if (!card) {
    return { ok: false, error: 'Card not found.' };
  }

  const userCards = database.prepare('SELECT * FROM cards WHERE user_id = ?').all(userId);
  if (userCards.length <= 1) {
    return { ok: false, error: 'You must keep at least one card in your wallet.' };
  }

  const wasDefault = Boolean(card.is_default_receive);
  database.prepare('DELETE FROM cards WHERE id = ?').run(cardId);

  if (wasDefault) {
    const nextDebit = database
      .prepare(
        `SELECT * FROM cards
         WHERE user_id = ? AND card_type = 'others' AND (account_kind = 'debit' OR account_kind IS NULL)
         LIMIT 1`
      )
      .get(userId);

    database.prepare('UPDATE cards SET is_default_receive = 0 WHERE user_id = ?').run(userId);
    if (nextDebit) {
      database.prepare('UPDATE cards SET is_default_receive = 1 WHERE id = ?').run(nextDebit.id);
    }
  }

  return { ok: true, card };
}

function formatPhoneDisplay(digits) {
  const clean = String(digits || '')
    .replace(/\D/g, '')
    .slice(-8);
  if (clean.length !== 8) {
    return null;
  }
  return `+65 ${clean.slice(0, 4)} ${clean.slice(4)}`;
}

function resolveCardForPayment(userId, paymentMethod) {
  const cards = getCards(userId);
  const method = String(paymentMethod || '').toLowerCase();

  if (method.includes('cashcard')) {
    return cards.find((card) => card.card_type === 'cashcard') || cards[0] || null;
  }

  if (method.includes('linked') || method.includes('debit') || method.includes('credit')) {
    return cards.find((card) => card.card_type === 'others') || cards[0] || null;
  }

  return cards.find((card) => card.card_type === 'prepaid') || cards[0] || null;
}

function isEmpty() {
  const row = getDb().prepare('SELECT COUNT(*) AS count FROM users').get();
  return row.count === 0;
}

function seed(data, options = {}) {
  const mode = options.mode || 'merge';
  if (mode === 'reset') {
    seedReset(data);
    return;
  }

  seedMerge(data);
}

function getNotifications(userId) {
  return getDb()
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map(parseNotificationRow)
    .sort((a, b) => period.parseOccurredAt(b.created_at) - period.parseOccurredAt(a.created_at));
}

function addNotification(notification) {
  getDb()
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, message, read, created_at, meta)
       VALUES (@id, @user_id, @type, @title, @message, @read, @created_at, @meta)`
    )
    .run({
      ...notification,
      read: notification.read ? 1 : 0,
      meta: notification.meta ? JSON.stringify(notification.meta) : null,
    });
  return notification;
}

function markNotificationRead(userId, notificationId) {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?')
    .get(notificationId, userId);
  if (!row) {
    return { ok: false, error: 'Notification not found.' };
  }

  database.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(notificationId);
  return { ok: true, notification: parseNotificationRow(database.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId)) };
}

function markAllNotificationsRead(userId) {
  getDb().prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
  return { ok: true };
}

function setCardTopUpEnabled(userId, cardId, enabled) {
  const database = getDb();
  const card = database.prepare('SELECT * FROM cards WHERE user_id = ? AND id = ?').get(userId, cardId);
  if (!card) {
    return { ok: false, error: 'Card not found.' };
  }
  if (!['prepaid', 'cashcard'].includes(card.card_type)) {
    return { ok: false, error: 'Only prepaid or CashCard wallets support top-up preferences.' };
  }

  database.prepare('UPDATE cards SET top_up_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, cardId);
  return { ok: true, card: database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) };
}

module.exports = {
  initialize,
  readDb,
  getUsers,
  getUser,
  findUserByPhone,
  getCards,
  getCardById,
  findLinkedCardByNumber,
  findAnyLinkedCardByNumber,
  addCard,
  addUser,
  updateUserPin,
  deleteCard,
  formatPhoneDisplay,
  addTransaction,
  updateCardBalance,
  setCardBalance,
  clearDefaultReceive,
  setDefaultReceiveCard,
  resolveCardForPayment,
  getTransactions,
  isEmpty,
  seed,
  getNotifications,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  setCardTopUpEnabled,
};
