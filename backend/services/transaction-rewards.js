const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');
const quests = require('./quests');
const db = require('../db');

const POINTS_PER_DOLLAR = 10;

/**
 * Mirrors merchant-tags.js's normalizeMerchant() (lowercase, trim, collapse
 * whitespace) — duplicated here on purpose rather than requiring that file
 * directly, since its dependency chain (../data/catalog-paths) is an ESM
 * module with top-level await, which crashes when require()'d synchronously
 * from a CommonJS file (Node's ERR_REQUIRE_ASYNC_MODULE). If catalog-paths.js
 * ever gets converted to plain CommonJS, this can be swapped back to
 * `const { normalizeMerchant } = require('./merchant-tags');`.
 */
function normalizeMerchant(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Call this right after a REAL merchant transaction is saved — i.e. after
 * `db.addTransaction(...)` succeeds in the receipt-scan or QR-payment
 * routes. Do NOT call this for card top-ups or peer-to-peer transfers —
 * those aren't merchant spending, so they don't earn points or advance
 * quests/challenges.
 *
 * `transaction` should be the same object passed into db.addTransaction
 * (needs `.id`, `.merchant`, `.category`, `.amount` — negative for a spend).
 *
 * Never throws: a failure here should not block the payment itself from
 * succeeding, since the money has already moved. Errors are logged instead.
 */
async function awardTransactionRewards(userId, transaction) {
  try {
    const spendAmount = Math.abs(transaction.amount);
    if (!(spendAmount > 0)) {
      return { pointsAwarded: 0 };
    }

    // ---- 1 point per $1 spent ----
    const pointsAwarded = Math.round(spendAmount * POINTS_PER_DOLLAR);
    const firestoreDb = getFirestore();
    const userRef = firestoreDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;

    await userRef.update({ points: currentPoints + pointsAwarded });
    await userPointsLedgerRef(firestoreDb, userId).doc().set({
      title: `Purchase at ${transaction.merchant}`,
      amount: pointsAwarded,
      type: 'transaction',
      tag: 'Transaction',
      icon: 'card-outline',
      timestamp: new Date().toISOString(),
    });

    // ---- Is this a merchant the user hasn't paid before? (for Explorer-style quests) ----
    const normalizedMerchant = normalizeMerchant(transaction.merchant);
    const priorTransactions = await db.getTransactions(userId);
    const isNewMerchant = !priorTransactions.some(
      (t) => t.id !== transaction.id && normalizeMerchant(t.merchant) === normalizedMerchant
    );

    // ---- Advance any matching daily quest / weekly quest / started challenge ----
    await quests.recordQuestEvent(userId, {
      eventType: 'transaction',
      amount: spendAmount,
      merchantId: normalizedMerchant,
      merchantCategory: transaction.category,
      isNewMerchant,
    });

    return { pointsAwarded };
  } catch (err) {
    console.error('awardTransactionRewards failed (payment itself still succeeded):', err);
    return { pointsAwarded: 0, error: true };
  }
}

module.exports = { awardTransactionRewards, POINTS_PER_DOLLAR };
