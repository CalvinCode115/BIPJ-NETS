const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');
const { getDateId } = require('./quests');

/** index 0 = Day 1, ... index 6 = Day 7 */
const REWARD_SCHEDULE = [1, 1, 3, 3, 5, 8, 10];

function getCheckinRef(db, userId) {
  return db.collection('users').doc(userId).collection('questMeta').doc('dailyCheckin');
}

/**
 * What the NEXT check-in would look like, without actually claiming it.
 * Used to render the 7-day progress row on the NETS Points page.
 */
async function getCheckinStatus(userId) {
  const db = getFirestore();
  const ref = getCheckinRef(db, userId);
  const snap = await ref.get();
  const todayId = getDateId();

  const data = snap.exists ? snap.data() : { lastCheckInDateId: null, currentDay: 0 };
  const alreadyCheckedInToday = data.lastCheckInDateId === todayId;

  let day;
  if (alreadyCheckedInToday) {
    day = data.currentDay; // today's already-claimed day
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = data.lastCheckInDateId === getDateId(yesterday);
    day = wasYesterday ? (data.currentDay % 7) + 1 : 1; // continue streak, or reset to Day 1
  }

  return {
    canCheckInToday: !alreadyCheckedInToday,
    currentDay: day,
    nextReward: REWARD_SCHEDULE[day - 1],
    schedule: REWARD_SCHEDULE,
  };
}

/**
 * Actually claims today's check-in. Missing a calendar day resets the
 * cycle back to Day 1 — this is a distinct streak from the "Daily
 * Check-In Streak Bonus" quest (that one only advances when a real
 * transaction happens; this one advances on tapping the Check In button).
 */
async function checkIn(userId) {
  const db = getFirestore();
  const ref = getCheckinRef(db, userId);
  const userRef = db.collection('users').doc(userId);
  const todayId = getDateId();

  return db.runTransaction(async (tx) => {
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(userRef)]);
    const data = snap.exists ? snap.data() : { lastCheckInDateId: null, currentDay: 0 };

    if (data.lastCheckInDateId === todayId) {
      return { ok: false, error: 'Already checked in today.' };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = data.lastCheckInDateId === getDateId(yesterday);
    const newDay = wasYesterday ? (data.currentDay % 7) + 1 : 1;
    const reward = REWARD_SCHEDULE[newDay - 1];

    const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;

    tx.set(ref, { lastCheckInDateId: todayId, currentDay: newDay }, { merge: true });
    tx.update(userRef, { points: currentPoints + reward });
    tx.set(userPointsLedgerRef(db, userId).doc(), {
      title: `Daily Check-In (Day ${newDay})`,
      amount: reward,
      type: 'bonus',
      tag: 'Bonus',
      icon: 'sparkles-outline',
      timestamp: new Date().toISOString(),
    });

    return { ok: true, day: newDay, reward };
  });
}

module.exports = {
  getCheckinStatus,
  checkIn,
  REWARD_SCHEDULE,
};
