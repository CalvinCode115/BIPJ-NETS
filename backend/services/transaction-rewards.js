const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');
const { getTodaysPointsBudget } = require('./points-budget');
const { capBalanceAward } = require('./points-balance-cap');
const quests = require('./quests');
const db = require('../db');

const POINTS_PER_DOLLAR = 1;

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

    const firestoreDb = getFirestore();
    const userRef = firestoreDb.collection('users').doc(userId);

    // ---- Everything that reads-then-decides-then-writes the cap and the
    // points balance MUST be atomic, or two near-simultaneous calls (e.g.
    // a double-tapped payment, or two receipts processed close together)
    // could both read the same "remaining budget" before either commits,
    // letting the real daily total slip past the cap. ----
    const result = await firestoreDb.runTransaction(async (tx) => {
      // ---- reads first ----
      const { pointsRemaining, transactionCapReached } = await getTodaysPointsBudget(firestoreDb, userId, tx);
      const userSnap = await tx.get(userRef);

      if (transactionCapReached) {
        // Hard stop: this transaction earns nothing and doesn't advance any
        // quest either — this is what actually prevents someone from
        // spamming small transactions to farm quest progress once points
        // alone are capped.
        return { pointsAwarded: 0, capped: true, capReason: 'daily_transaction_cap' };
      }

      const uncappedPoints = Math.round(spendAmount * POINTS_PER_DOLLAR);
      const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;
      const pointsAwarded = capBalanceAward(currentPoints, Math.min(uncappedPoints, pointsRemaining));

      // ---- then writes ----
      if (pointsAwarded > 0) {
        tx.update(userRef, { points: currentPoints + pointsAwarded });
        tx.set(userPointsLedgerRef(firestoreDb, userId).doc(), {
          title: `Purchase at ${transaction.merchant}`,
          amount: pointsAwarded,
          type: 'transaction',
          tag: 'Transaction',
          icon: 'card-outline',
          timestamp: new Date().toISOString(),
        });
      }

      return { pointsAwarded, capped: pointsAwarded < uncappedPoints };
    });

    // ---- Is this a merchant the user hasn't paid before? (for Explorer-style quests) ----
    const normalizedMerchant = normalizeMerchant(transaction.merchant);
    const priorTransactions = await db.getTransactions(userId);
    const isNewMerchant = !priorTransactions.some(
      (t) => t.id !== transaction.id && normalizeMerchant(t.merchant) === normalizedMerchant
    );

    // ---- Advance any matching daily quest / weekly quest / started
    // challenge — this still runs even if pointsAwarded is 0 due to
    // hitting the points cap (only the transaction-count cap above blocks
    // quest progress entirely). Kept outside the transaction above since
    // it doesn't touch the points cap or balance at all. ----
    await quests.recordQuestEvent(userId, {
      eventType: 'transaction',
      amount: spendAmount,
      merchantId: normalizedMerchant,
      merchantCategory: transaction.category,
      isNewMerchant,
    });

    return result;
  } catch (err) {
    console.error('awardTransactionRewards failed (payment itself still succeeded):', err);
    return { pointsAwarded: 0, error: true };
  }
}

module.exports = { awardTransactionRewards, POINTS_PER_DOLLAR };
