const period = require('../services/period');
const { getFirestore } = require('../firebase/admin');
const { seedFirestore } = require('./firestore-seed');
const {
  userRef,
  userCardsRef,
  userTransactionsRef,
  userNotificationsRef,
  appMetaRef,
} = require('./firestore-paths');
const { LOW_BALANCE_THRESHOLD } = require('../services/wallet-config');

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

function formatPhoneDisplay(digits) {
  const clean = String(digits || '')
    .replace(/\D/g, '')
    .slice(-8);
  if (clean.length !== 8) {
    return null;
  }
  return `+65 ${clean.slice(0, 4)} ${clean.slice(4)}`;
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function userFromDoc(doc) {
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

function cardFromDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    top_up_enabled: boolToInt(data.top_up_enabled),
    is_default_receive: boolToInt(data.is_default_receive),
  };
}

function transactionFromDoc(doc) {
  return { id: doc.id, ...doc.data() };
}

function notificationFromDoc(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    read: Boolean(data.read),
    meta: data.meta ?? null,
  };
}

function cardToDoc(card) {
  return {
    user_id: card.user_id,
    card_type: card.card_type,
    label: card.label,
    card_number: card.card_number,
    masked_number: card.masked_number ?? null,
    cardholder_name: card.cardholder_name ?? null,
    expiry_date: card.expiry_date ?? null,
    balance: card.balance,
    credit_limit: card.credit_limit ?? null,
    top_up_enabled: Boolean(card.top_up_enabled),
    bank_name: card.bank_name ?? null,
    account_kind: card.account_kind ?? null,
    is_default_receive: Boolean(card.is_default_receive),
  };
}

function transactionToDoc(txn) {
  return {
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
  };
}

async function initialize() {
  getFirestore();
}

async function readDb() {
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map(userFromDoc);

  const cards = [];
  const transactions = [];
  const notifications = [];

  for (const user of users) {
    const [cardsSnap, txSnap, notifSnap] = await Promise.all([
      userCardsRef(db, user.id).get(),
      userTransactionsRef(db, user.id).get(),
      userNotificationsRef(db, user.id).get(),
    ]);
    cards.push(...cardsSnap.docs.map(cardFromDoc));
    transactions.push(...txSnap.docs.map(transactionFromDoc));
    notifications.push(...notifSnap.docs.map(notificationFromDoc));
  }

  const metaSnap = await appMetaRef(db).get();
  const seedVersion = metaSnap.exists ? Number(metaSnap.data().seed_version || 0) : 0;

  return { users, cards, transactions, notifications, seedVersion };
}

async function getUsers() {
  const db = getFirestore();
  const snap = await db.collection('users').get();
  return snap.docs.map(userFromDoc).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function getUser(userId) {
  const db = getFirestore();
  const doc = await userRef(db, userId).get();
  return userFromDoc(doc);
}

async function findUserByPhone(phone) {
  const suffix = phoneSuffix(phone);
  const users = await getUsers();
  return users.find((user) => phoneSuffix(user.phone) === suffix) || null;
}

async function getCards(userId, cardType) {
  const db = getFirestore();
  let query = userCardsRef(db, userId);

  if (cardType) {
    query = query.where('card_type', '==', cardType);
  }

  const snap = await query.get();
  const rows = snap.docs.map(cardFromDoc);
  rows.sort((a, b) => {
    const typeCmp = String(a.card_type).localeCompare(String(b.card_type));
    return typeCmp !== 0 ? typeCmp : String(a.label).localeCompare(String(b.label));
  });

  const synced = [];
  for (const row of rows) {
    synced.push(await syncAutoTopUpPreference(row));
  }
  return synced;
}

async function findCardDocById(cardId) {
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();

  for (const userDoc of usersSnap.docs) {
    const cardRef = userCardsRef(db, userDoc.id).doc(cardId);
    const doc = await cardRef.get();
    if (doc.exists) {
      return doc;
    }
  }

  return null;
}

async function findLinkedCardByNumber(userId, cardNumberDigits) {
  const cards = await getCards(userId);
  return cards.find((card) => normalizeCardDigits(card.card_number) === cardNumberDigits) || null;
}

async function findAnyLinkedCardByNumber(cardNumberDigits) {
  const db = getFirestore();
  const usersSnap = await db.collection('users').get();

  for (const userDoc of usersSnap.docs) {
    const cardsSnap = await userCardsRef(db, userDoc.id).get();
    for (const cardDoc of cardsSnap.docs) {
      const card = cardFromDoc(cardDoc);
      if (normalizeCardDigits(card.card_number) === cardNumberDigits) {
        return card;
      }
    }
  }

  return null;
}

async function addCard(card) {
  const db = getFirestore();
  await userCardsRef(db, card.user_id).doc(card.id).set(cardToDoc(card), { merge: true });
  return card;
}

async function getCardById(userId, cardId) {
  const db = getFirestore();
  const doc = await userCardsRef(db, userId).doc(cardId).get();
  if (!doc.exists) {
    const globalDoc = await findCardDocById(cardId);
    if (!globalDoc || globalDoc.data().user_id !== userId) {
      return null;
    }
    return syncAutoTopUpPreference(cardFromDoc(globalDoc));
  }
  return syncAutoTopUpPreference(cardFromDoc(doc));
}

async function getTransactions(userId, filters = {}) {
  const db = getFirestore();
  const snap = await userTransactionsRef(db, userId).get();
  let rows = snap.docs.map(transactionFromDoc);

  if (filters.cardId) {
    rows = rows.filter((row) => row.card_id === filters.cardId);
  } else if (filters.cardType) {
    const cardIds = new Set((await getCards(userId, filters.cardType)).map((card) => card.id));
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

async function addTransaction(transaction) {
  const db = getFirestore();
  await userTransactionsRef(db, transaction.user_id)
    .doc(transaction.id)
    .set(transactionToDoc(transaction), { merge: true });
  return transaction;
}

async function syncAutoTopUpPreference(cardRow) {
  if (!cardRow || (cardRow.card_type !== 'prepaid' && cardRow.card_type !== 'cashcard')) {
    return cardRow;
  }

  const enabled = cardRow.balance < LOW_BALANCE_THRESHOLD ? 1 : 0;
  if (Number(cardRow.top_up_enabled) !== enabled) {
    const db = getFirestore();
    const ref = userCardsRef(db, cardRow.user_id).doc(cardRow.id);
    await ref.update({ top_up_enabled: Boolean(enabled) });
    const updated = await ref.get();
    return cardFromDoc(updated);
  }

  return cardRow;
}

async function updateCardBalance(cardId, delta) {
  const cardDoc = await findCardDocById(cardId);
  if (!cardDoc) {
    return null;
  }

  const card = cardFromDoc(cardDoc);
  const balance = Math.round(Math.max(0, card.balance + delta) * 100) / 100;
  const db = getFirestore();
  const ref = userCardsRef(db, card.user_id).doc(cardId);
  await ref.update({ balance });
  const updated = await ref.get();
  return syncAutoTopUpPreference(cardFromDoc(updated));
}

async function setCardBalance(cardId, balance) {
  const cardDoc = await findCardDocById(cardId);
  if (!cardDoc) {
    return null;
  }

  const card = cardFromDoc(cardDoc);
  const nextBalance = Math.round(Math.max(0, balance) * 100) / 100;
  const db = getFirestore();
  const ref = userCardsRef(db, card.user_id).doc(cardId);
  await ref.update({ balance: nextBalance });
  const updated = await ref.get();
  return syncAutoTopUpPreference(cardFromDoc(updated));
}

async function clearDefaultReceive(userId) {
  const db = getFirestore();
  const snap = await userCardsRef(db, userId).where('is_default_receive', '==', true).get();
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.update(doc.ref, { is_default_receive: false }));
  if (!snap.empty) {
    await batch.commit();
  }
}

async function setDefaultReceiveCard(userId, cardId) {
  const db = getFirestore();
  const targetRef = userCardsRef(db, userId).doc(cardId);
  const target = await targetRef.get();
  if (!target.exists) {
    return null;
  }

  await db.runTransaction(async (transaction) => {
    const cardsSnap = await transaction.get(userCardsRef(db, userId));
    cardsSnap.docs.forEach((doc) => {
      transaction.update(doc.ref, { is_default_receive: doc.id === cardId });
    });
  });

  const updated = await targetRef.get();
  return cardFromDoc(updated);
}

async function addUser(user) {
  const db = getFirestore();
  await userRef(db, user.id).set(
    {
      name: user.name,
      phone: user.phone,
      pin: user.pin,
      tier: user.tier,
      points: user.points,
      email: user.email ?? null,
    },
    { merge: true }
  );
  return user;
}

async function updateUserPin(userId, pin) {
  const db = getFirestore();
  const ref = userRef(db, userId);
  const doc = await ref.get();
  if (!doc.exists) {
    return null;
  }

  await ref.update({ pin });
  const updated = await ref.get();
  return userFromDoc(updated);
}

async function deleteCard(userId, cardId) {
  const db = getFirestore();
  const ref = userCardsRef(db, userId).doc(cardId);
  const doc = await ref.get();
  if (!doc.exists) {
    return { ok: false, error: 'Card not found.' };
  }

  const card = cardFromDoc(doc);
  const userCards = await getCards(userId);
  if (userCards.length <= 1) {
    return { ok: false, error: 'You must keep at least one card in your wallet.' };
  }

  const wasDefault = Boolean(card.is_default_receive);
  await ref.delete();

  if (wasDefault) {
    const nextDebit = userCards.find(
      (c) =>
        c.id !== cardId &&
        c.card_type === 'others' &&
        (c.account_kind === 'debit' || c.account_kind == null)
    );

    await clearDefaultReceive(userId);
    if (nextDebit) {
      await userCardsRef(db, userId).doc(nextDebit.id).update({ is_default_receive: true });
    }
  }

  return { ok: true, card };
}

function resolveCardForPayment(userId, paymentMethod) {
  return getCards(userId).then((cards) => {
    const method = String(paymentMethod || '').toLowerCase();

    if (method.includes('cashcard')) {
      return cards.find((card) => card.card_type === 'cashcard') || cards[0] || null;
    }

    if (method.includes('linked') || method.includes('debit') || method.includes('credit')) {
      return cards.find((card) => card.card_type === 'others') || cards[0] || null;
    }

    return cards.find((card) => card.card_type === 'prepaid') || cards[0] || null;
  });
}

async function isEmpty() {
  const db = getFirestore();
  const snap = await db.collection('users').limit(1).get();
  return snap.empty;
}

async function seed(data, options = {}) {
  const mode = options.mode || 'merge';
  await seedFirestore(data, { reset: mode === 'reset' });
}

async function getNotifications(userId) {
  const db = getFirestore();
  const snap = await userNotificationsRef(db, userId).get();
  return snap.docs
    .map(notificationFromDoc)
    .sort((a, b) => period.parseOccurredAt(b.created_at) - period.parseOccurredAt(a.created_at));
}

async function addNotification(notification) {
  const db = getFirestore();
  await userNotificationsRef(db, notification.user_id)
    .doc(notification.id)
    .set({
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: Boolean(notification.read),
      created_at: notification.created_at,
      meta: notification.meta ?? null,
    });
  return notification;
}

async function markNotificationRead(userId, notificationId) {
  const db = getFirestore();
  const ref = userNotificationsRef(db, userId).doc(notificationId);
  const doc = await ref.get();
  if (!doc.exists) {
    return { ok: false, error: 'Notification not found.' };
  }

  await ref.update({ read: true });
  const updated = await ref.get();
  return { ok: true, notification: notificationFromDoc(updated) };
}

async function markAllNotificationsRead(userId) {
  const db = getFirestore();
  const snap = await userNotificationsRef(db, userId).where('read', '==', false).get();
  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
    await batch.commit();
  }
  return { ok: true };
}

async function setCardTopUpEnabled(userId, cardId, enabled) {
  const db = getFirestore();
  const ref = userCardsRef(db, userId).doc(cardId);
  const doc = await ref.get();
  if (!doc.exists) {
    return { ok: false, error: 'Card not found.' };
  }

  const card = cardFromDoc(doc);
  if (!['prepaid', 'cashcard'].includes(card.card_type)) {
    return { ok: false, error: 'Only prepaid or CashCard wallets support top-up preferences.' };
  }

  await ref.update({ top_up_enabled: Boolean(enabled) });
  const updated = await ref.get();
  return { ok: true, card: cardFromDoc(updated) };
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
  getMultiCurrencyWallet,
  updateMultiCurrencyBalance,
  exchangeCurrency,
  deductCurrency,
};

// ═════════════════════════════════════════════════════════════════
// MULTI-CURRENCY WALLET HELPERS
// ═════════════════════════════════════════════════════════════════

async function getMultiCurrencyWallet(cardId) {
  const cardDoc = await findCardDocById(cardId);
  if (!cardDoc) {
    return null;
  }

  const card = cardFromDoc(cardDoc);
  // Migrate: if no multiCurrency, initialize from balance
  const multiCurrency = card.multi_currency || { SGD: card.balance };
  
  return {
    cardId: card.id,
    balances: multiCurrency,
    currencies: Object.keys(multiCurrency),
  };
}

async function updateMultiCurrencyBalance(cardId, currency, amount) {
  const cardDoc = await findCardDocById(cardId);
  if (!cardDoc) {
    return null;
  }

  const card = cardFromDoc(cardDoc);
  const db = getFirestore();
  const ref = userCardsRef(db, card.user_id).doc(cardId);

  // Get current multiCurrency or initialize
  const currentMulti = card.multi_currency || { SGD: card.balance };
  const nextMulti = { ...currentMulti };

  // Update the specific currency
  if (currency === 'SGD') {
    // Also update the main balance field for backward compat
    const nextBalance = Math.round(Math.max(0, amount) * 100) / 100;
    nextMulti.SGD = nextBalance;
    await ref.update({ 
      balance: nextBalance,
      multi_currency: nextMulti 
    });
  } else {
    nextMulti[currency] = Math.round(Math.max(0, amount) * 100) / 100;
    // Remove if depleted
    if (nextMulti[currency] < 0.01) {
      delete nextMulti[currency];
    }
    await ref.update({ multi_currency: nextMulti });
  }

  const updated = await ref.get();
  return syncAutoTopUpPreference(cardFromDoc(updated));
}

async function exchangeCurrency(cardId, fromCurrency, toCurrency, amount, rate) {
  const cardDoc = await findCardDocById(cardId);
  if (!cardDoc) {
    return { ok: false, error: 'Card not found.' };
  }

  const card = cardFromDoc(cardDoc);
  const db = getFirestore();
  const ref = userCardsRef(db, card.user_id).doc(cardId);

  // Get current multiCurrency or initialize
  const currentMulti = card.multi_currency || { SGD: card.balance };
  const nextMulti = { ...currentMulti };

  // Check sufficient balance
  const fromBalance = nextMulti[fromCurrency] || 0;
  if (fromBalance < amount) {
    return { 
      ok: false, 
      error: `Insufficient ${fromCurrency} balance. Available: ${fromBalance.toFixed(2)}, Need: ${amount.toFixed(2)}` 
    };
  }

  // Calculate
  const fee = amount * 0.005;
  const amountAfterFee = amount - fee;
  const received = amountAfterFee * rate;

  // Update balances
  nextMulti[fromCurrency] = Math.round(Math.max(0, (nextMulti[fromCurrency] || 0) - amount) * 100) / 100;
  nextMulti[toCurrency] = Math.round(((nextMulti[toCurrency] || 0) + received) * 100) / 100;

  // Remove depleted currencies (except SGD)
  if (fromCurrency !== 'SGD' && nextMulti[fromCurrency] < 0.01) {
    delete nextMulti[fromCurrency];
  }

  // Update Firestore
  const updateData = { multi_currency: nextMulti };
  if (fromCurrency === 'SGD' || toCurrency === 'SGD') {
    updateData.balance = nextMulti.SGD;
  }

  await ref.update(updateData);
  const updated = await ref.get();
  const refreshedCard = syncAutoTopUpPreference(cardFromDoc(updated));

  return {
    ok: true,
    card: refreshedCard,
    newBalances: nextMulti,
    fee: fee,
    received: received,
  };
}

async function deductCurrency(cardId, currency, amount) {
  return exchangeCurrency(cardId, currency, currency, amount, 1);
}
