const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');

/** Start of the current week (Monday 00:00 Asia/Singapore), as an ISO string. */
function getWeekStartIso() {
  const sgtNow = new Date(Date.now() + 8 * 60 * 60 * 1000); // shift to SGT wall-clock
  const dayOfWeek = sgtNow.getUTCDay(); // Sun=0 ... Sat=6
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const sgtMonday = new Date(
    Date.UTC(sgtNow.getUTCFullYear(), sgtNow.getUTCMonth(), sgtNow.getUTCDate() - daysSinceMonday)
  );
  return new Date(sgtMonday.getTime() - 8 * 60 * 60 * 1000).toISOString(); // shift back to real UTC instant
}

/**
 * Total points balance + this week's earned/spent, for the NETS Points page.
 */
async function getPointsBalance(userId) {
  const db = getFirestore();
  const userSnap = await db.collection('users').doc(userId).get();
  const totalPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;

  const weekStartIso = getWeekStartIso();
  const weekEntriesSnap = await userPointsLedgerRef(db, userId)
    .where('timestamp', '>=', weekStartIso)
    .get();

  let earnedThisWeek = 0;
  let spentThisWeek = 0;
  weekEntriesSnap.docs.forEach((doc) => {
    const amount = doc.data().amount ?? 0;
    if (amount > 0) {
      earnedThisWeek += amount;
    } else {
      spentThisWeek += Math.abs(amount);
    }
  });

  return { totalPoints, earnedThisWeek, spentThisWeek };
}

/**
 * Points History list, with optional text search and date-range filtering.
 *
 * options:
 *   search    - case-insensitive substring match against entry titles
 *   startDate - 'YYYY-MM-DD', inclusive
 *   endDate   - 'YYYY-MM-DD', inclusive (whole day)
 *   limit     - max entries to return (default 100)
 */
async function getPointsHistory(userId, { search, startDate, endDate, limit = 100 } = {}) {
  const db = getFirestore();
  let query = userPointsLedgerRef(db, userId).orderBy('timestamp', 'desc');

  if (startDate) {
    const startOfDay = new Date(`${startDate}T00:00:00+08:00`);
    query = query.where('timestamp', '>=', startOfDay.toISOString());
  }
  if (endDate) {
    const endOfDay = new Date(`${endDate}T23:59:59+08:00`);
    query = query.where('timestamp', '<=', endOfDay.toISOString());
  }

  const snap = await query.get();
  let entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (search) {
    const term = search.toLowerCase();
    entries = entries.filter((e) => (e.title ?? '').toLowerCase().includes(term));
  }

  return entries.slice(0, limit);
}

module.exports = {
  getPointsBalance,
  getPointsHistory,
};
