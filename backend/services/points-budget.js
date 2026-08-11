const { userPointsLedgerRef } = require('../db/firestore-paths');

const DAILY_POINTS_CAP = 300;
const DAILY_TRANSACTION_CAP = 20;

/** Start of today (00:00 Asia/Singapore), as an ISO string. */
function todayStartIso() {
  const sgtNow = new Date(Date.now() + 8 * 60 * 60 * 1000); // shift to SGT wall-clock
  const sgtMidnight = new Date(Date.UTC(sgtNow.getUTCFullYear(), sgtNow.getUTCMonth(), sgtNow.getUTCDate()));
  return new Date(sgtMidnight.getTime() - 8 * 60 * 60 * 1000).toISOString(); // shift back to a real UTC instant
}

/**
 * Reads today's points-ledger entries and returns:
 *   - pointsRemaining: how many more points can still be earned today
 *     across ALL sources (transactions, daily/weekly quests, challenges)
 *   - transactionCapReached: whether 20 spending transactions have already
 *     earned points today (a separate cap, only for the base 1pt/$1
 *     transaction reward — quest/challenge claims are one-time per period
 *     already, so they don't need a count cap of their own)
 *
 * `tx` is optional — pass it when calling from inside an existing
 * Firestore transaction (quests.js's claim functions); omit it for a plain
 * read (transaction-rewards.js, which isn't itself transactional). Either
 * way, this MUST be called before any writes in the same operation.
 */
async function getTodaysPointsBudget(db, userId, tx = null) {
  const query = userPointsLedgerRef(db, userId).where('timestamp', '>=', todayStartIso());
  const snap = tx ? await tx.get(query) : await query.get();

  let earnedToday = 0;
  let transactionCountToday = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data();
    if ((data.amount ?? 0) > 0) {
      earnedToday += data.amount;
    }
    if (data.type === 'transaction') {
      transactionCountToday += 1;
    }
  });

  return {
    pointsRemaining: Math.max(0, DAILY_POINTS_CAP - earnedToday),
    transactionCapReached: transactionCountToday >= DAILY_TRANSACTION_CAP,
  };
}

module.exports = {
  getTodaysPointsBudget,
  DAILY_POINTS_CAP,
  DAILY_TRANSACTION_CAP,
};
