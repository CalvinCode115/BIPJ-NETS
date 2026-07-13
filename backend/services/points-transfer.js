const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');
const db = require('../db');

/**
 * Looks up a user by phone number (reuses your groupmate's existing
 * db.findUserByPhone, already used by p2p-transfer.js for money transfers —
 * this is the same lookup, just for the Send Points flow).
 */
async function lookupUserByPhone(phone) {
  const user = await db.findUserByPhone(phone);
  if (!user) {
    return { found: false };
  }
  return { found: true, name: user.name, userId: user.id };
}

/**
 * Sends NETS Points (not dollars — this is entirely separate from the
 * existing card-based money transfer in p2p-transfer.js) from one user to
 * another, identified by phone number. Deducts from sender, credits
 * recipient, and logs a Points History entry on both sides.
 */
async function sendPoints(fromUserId, { toPhone, amount, comment }) {
  if (!(amount > 0)) {
    return { ok: false, error: 'Enter an amount greater than 0.' };
  }

  const toUser = await db.findUserByPhone(toPhone);
  if (!toUser) {
    return { ok: false, error: 'Payee not found.' };
  }
  if (toUser.id === fromUserId) {
    return { ok: false, error: 'You cannot send points to yourself.' };
  }

  const firestoreDb = getFirestore();
  const fromRef = firestoreDb.collection('users').doc(fromUserId);
  const toRef = firestoreDb.collection('users').doc(toUser.id);

  return firestoreDb.runTransaction(async (tx) => {
    const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);

    if (!fromSnap.exists) {
      return { ok: false, error: 'Sender not found.' };
    }

    const fromData = fromSnap.data();
    const fromPoints = fromData.points ?? 0;
    if (fromPoints < amount) {
      return { ok: false, error: 'Not enough points to send.' };
    }

    const toPoints = toSnap.exists ? toSnap.data().points ?? 0 : 0;

    tx.update(fromRef, { points: fromPoints - amount });
    tx.update(toRef, { points: toPoints + amount });

    const now = new Date().toISOString();

    tx.set(userPointsLedgerRef(firestoreDb, fromUserId).doc(), {
      title: `Sent Points to ${toUser.name}`,
      amount: -amount,
      type: 'transfer',
      tag: 'Transfer',
      icon: 'paper-plane-outline',
      timestamp: now,
      comment: comment || null,
    });

    tx.set(userPointsLedgerRef(firestoreDb, toUser.id).doc(), {
      title: `Received Points from ${fromData.name}`,
      amount,
      type: 'transfer',
      tag: 'Transfer',
      icon: 'paper-plane-outline',
      timestamp: now,
      comment: comment || null,
    });

    return { ok: true, toName: toUser.name, amount };
  });
}

module.exports = {
  lookupUserByPhone,
  sendPoints,
};
