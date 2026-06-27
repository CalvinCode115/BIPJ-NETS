const { getFirestore } = require('../firebase/admin');
const {
  USER_SUBCOLLECTIONS,
  userRef,
  userCardsRef,
  userTransactionsRef,
  appMetaRef,
} = require('./firestore-paths');

const BATCH_LIMIT = 400;

async function deleteCollection(ref, batchSize = BATCH_LIMIT) {
  const snapshot = await ref.limit(batchSize).get();
  if (snapshot.empty) {
    return;
  }

  const db = ref.firestore;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  if (snapshot.size >= batchSize) {
    await deleteCollection(ref, batchSize);
  }
}

async function deleteUserTree(db, userId) {
  for (const name of USER_SUBCOLLECTIONS) {
    await deleteCollection(userRef(db, userId).collection(name));
  }
  await userRef(db, userId).delete();
}

async function clearAllUsers(db) {
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    await deleteUserTree(db, doc.id);
  }
}

function userDoc(user) {
  return {
    name: user.name,
    phone: user.phone,
    pin: user.pin,
    tier: user.tier,
    points: user.points,
    email: user.email ?? null,
  };
}

function cardDoc(card) {
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

function transactionDoc(txn) {
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

async function writeBatch(db, writes) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    chunk.forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
}

async function seedFirestore(data, { reset = false } = {}) {
  const db = getFirestore();
  const writes = [];

  if (reset) {
    await clearAllUsers(db);
  }

  for (const user of data.users) {
    writes.push({
      ref: userRef(db, user.id),
      data: userDoc(user),
    });
  }

  for (const card of data.cards) {
    writes.push({
      ref: userCardsRef(db, card.user_id).doc(card.id),
      data: cardDoc(card),
    });
  }

  for (const txn of data.transactions) {
    writes.push({
      ref: userTransactionsRef(db, txn.user_id).doc(txn.id),
      data: transactionDoc(txn),
    });
  }

  await writeBatch(db, writes);
  await appMetaRef(db).set(
    {
      seed_version: data.seedVersion ?? 0,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    users: data.users.length,
    cards: data.cards.length,
    transactions: data.transactions.length,
    seedVersion: data.seedVersion ?? 0,
  };
}

module.exports = {
  seedFirestore,
  clearAllUsers,
};
