const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');
const db = require('../db');
const notifications = require('./notifications');
const { capBalanceAward } = require('./points-balance-cap');

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
 *
 * If sending the full amount would push the RECEIVER over the 5,000-point
 * balance cap, nothing is moved on the first call — instead it returns
 * `wouldExceedCap: true` and `maxSendable` (how much WOULD fit), so the
 * sender can be shown a choice. Call again with `allowPartial: true` to
 * actually send that reduced amount — the backend recomputes the receiver's
 * current headroom fresh on that second call rather than trusting a
 * client-remembered number, in case anything changed in between.
 */
async function sendPoints(fromUserId, { toPhone, amount, comment, allowPartial = false }) {
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

  const result = await firestoreDb.runTransaction(async (tx) => {
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
    const maxSendable = capBalanceAward(toPoints, amount);

    if (maxSendable < amount && !allowPartial) {
      // Nothing moves yet — surface the choice back to the sender instead.
      return {
        ok: false,
        wouldExceedCap: true,
        maxSendable,
        error:
          maxSendable > 0
            ? `Sending ${amount} points would push your friend over the 5,000-point limit. You can send up to ${maxSendable} points instead.`
            : `Your friend is already at the 5,000-point limit and can't receive more right now.`,
      };
    }

    const amountToSend = allowPartial ? maxSendable : amount;
    if (amountToSend <= 0) {
      return { ok: false, error: `Your friend is already at the 5,000-point limit and can't receive more right now.` };
    }

    tx.update(fromRef, { points: fromPoints - amountToSend });
    tx.update(toRef, { points: toPoints + amountToSend });

    const now = new Date().toISOString();

    tx.set(userPointsLedgerRef(firestoreDb, fromUserId).doc(), {
      title: `Sent Points to ${toUser.name}`,
      amount: -amountToSend,
      type: 'transfer',
      tag: 'Transfer',
      icon: 'paper-plane-outline',
      timestamp: now,
      comment: comment || null,
    });

    tx.set(userPointsLedgerRef(firestoreDb, toUser.id).doc(), {
      title: `Received Points from ${fromData.name}`,
      amount: amountToSend,
      type: 'transfer',
      tag: 'Transfer',
      icon: 'paper-plane-outline',
      timestamp: now,
      comment: comment || null,
    });

    return {
      ok: true,
      toName: toUser.name,
      amount: amountToSend,
      wasCapped: amountToSend < amount,
      fromName: fromData.name || 'Someone',
      toUserId: toUser.id,
    };
  });

  // Home notification for the recipient — outside the money txn so a
  // notification write failure never rolls back the points transfer.
  if (result?.ok) {
    try {
      await notifications.createPointsReceivedNotification(result.toUserId, {
        fromName: result.fromName,
        amount: result.amount,
      });
    } catch (err) {
      console.error('createPointsReceivedNotification failed (points still sent):', err);
    }
  }

  return result;
}

module.exports = {
  lookupUserByPhone,
  sendPoints,
};
