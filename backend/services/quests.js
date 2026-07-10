const { getFirestore } = require('../firebase/admin');
const {
  dailyQuestTemplatesRef,
  weeklyQuestTemplatesRef,
  dailyQuestRotationsRef,
  weeklyQuestRotationsRef,
  partnerChallengesRef,
  userDailyQuestProgressRef,
  userWeeklyQuestProgressRef,
  userChallengeProgressRef,
  userQuestMetaRef,
  userPointsLedgerRef,
} = require('../db/firestore-paths');

const TIMEZONE = 'Asia/Singapore';
const DAILY_ROTATION_MIN = 4;
const DAILY_ROTATION_MAX = 5;
const WEEKLY_ROTATION_SIZE = 3;

// ---------------------------------------------------------------------------
// Date helpers (all evaluated in Asia/Singapore, independent of server TZ)
// ---------------------------------------------------------------------------

function getDateId(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // en-CA locale => YYYY-MM-DD
}

function getWeekId(date = new Date()) {
  const sgDateStr = getDateId(date);
  const sgDate = new Date(`${sgDateStr}T00:00:00Z`);

  const target = new Date(sgDate.getTime());
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  const weekNumber =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/** Shifts a Date so its getUTC* fields read as Asia/Singapore wall-clock time (SGT is UTC+8, no DST). */
function toSgtWallClock(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

/** Precise countdown to the next 00:00 Asia/Singapore. */
function getResetsInLabel() {
  const sgtNow = toSgtWallClock();
  const sgtNextMidnight = new Date(
    Date.UTC(sgtNow.getUTCFullYear(), sgtNow.getUTCMonth(), sgtNow.getUTCDate() + 1)
  );
  return formatDuration(sgtNextMidnight.getTime() - sgtNow.getTime());
}

/** Precise countdown to the next Monday 00:00 Asia/Singapore. */
function getWeeklyResetsInLabel() {
  const sgtNow = toSgtWallClock();
  const dayOfWeek = sgtNow.getUTCDay(); // Sun=0 ... Sat=6
  const daysUntilMonday = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7) || 7;
  const sgtNextMonday = new Date(
    Date.UTC(sgtNow.getUTCFullYear(), sgtNow.getUTCMonth(), sgtNow.getUTCDate() + daysUntilMonday)
  );
  return formatDuration(sgtNextMonday.getTime() - sgtNow.getTime());
}

function pickRandom(items, count) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Rotations (shared by ALL users — lazily created on first request each
// day/week, since this project has no cron/scheduler infrastructure)
// ---------------------------------------------------------------------------

async function getOrCreateDailyRotation(db) {
  const dateId = getDateId();
  const ref = dailyQuestRotationsRef(db).doc(dateId);
  const snap = await ref.get();
  if (snap.exists) {
    return { dateId, ...snap.data() };
  }

  const templatesSnap = await dailyQuestTemplatesRef(db).where('active', '==', true).get();
  const templateIds = templatesSnap.docs.map((d) => d.id);
  const size = randomBetween(DAILY_ROTATION_MIN, DAILY_ROTATION_MAX);
  const questTemplateIds = pickRandom(templateIds, size);

  const data = { questTemplateIds, generatedAt: new Date().toISOString() };
  await ref.set(data);
  return { dateId, ...data };
}

async function getOrCreateWeeklyRotation(db) {
  const weekId = getWeekId();
  const ref = weeklyQuestRotationsRef(db).doc(weekId);
  const snap = await ref.get();
  if (snap.exists) {
    return { weekId, ...snap.data() };
  }

  const templatesSnap = await weeklyQuestTemplatesRef(db).where('active', '==', true).get();
  const templateIds = templatesSnap.docs.map((d) => d.id);
  const questTemplateIds = pickRandom(templateIds, WEEKLY_ROTATION_SIZE);

  const data = { questTemplateIds, generatedAt: new Date().toISOString() };
  await ref.set(data);
  return { weekId, ...data };
}

// ---------------------------------------------------------------------------
// Per-user progress (lazily created)
// ---------------------------------------------------------------------------

async function ensureDailyProgress(db, userId, rotation) {
  const ref = userDailyQuestProgressRef(db, userId).doc(rotation.dateId);
  const snap = await ref.get();
  if (snap.exists) {
    return snap.data();
  }

  const templateDocs = await Promise.all(
    rotation.questTemplateIds.map((id) => dailyQuestTemplatesRef(db).doc(id).get())
  );
  const quests = {};
  templateDocs.forEach((doc) => {
    if (!doc.exists) return;
    quests[doc.id] = { current: 0, target: doc.data().requirementTarget, completed: false, claimed: false };
  });

  await ref.set({ quests });
  return { quests };
}

async function ensureWeeklyProgress(db, userId, rotation) {
  const ref = userWeeklyQuestProgressRef(db, userId).doc(rotation.weekId);
  const snap = await ref.get();
  if (snap.exists) {
    return snap.data();
  }

  const templateDocs = await Promise.all(
    rotation.questTemplateIds.map((id) => weeklyQuestTemplatesRef(db).doc(id).get())
  );
  const quests = {};
  templateDocs.forEach((doc) => {
    if (!doc.exists) return;
    quests[doc.id] = { current: 0, target: doc.data().requirementTarget, completed: false, claimed: false };
  });

  await ref.set({ quests });
  return { quests };
}

// ---------------------------------------------------------------------------
// Read APIs — shaped to match the front-end pages directly
// ---------------------------------------------------------------------------

async function getDailyQuestsForUser(userId) {
  const db = getFirestore();
  const rotation = await getOrCreateDailyRotation(db);
  const progress = await ensureDailyProgress(db, userId, rotation);

  const templateDocs = await Promise.all(
    rotation.questTemplateIds.map((id) => dailyQuestTemplatesRef(db).doc(id).get())
  );

  const quests = templateDocs
    .filter((doc) => doc.exists)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
      progress: progress.quests[doc.id] ?? { current: 0, target: doc.data().requirementTarget, completed: false, claimed: false },
    }));

  return {
    resetsIn: getResetsInLabel(),
    completedCount: quests.filter((q) => q.progress.claimed).length,
    totalCount: quests.length,
    incompleteQuests: quests.filter((q) => !q.progress.claimed),
    completedQuests: quests.filter((q) => q.progress.claimed),
  };
}

async function getWeeklyQuestsForUser(userId) {
  const db = getFirestore();
  const rotation = await getOrCreateWeeklyRotation(db);
  const progress = await ensureWeeklyProgress(db, userId, rotation);

  const templateDocs = await Promise.all(
    rotation.questTemplateIds.map((id) => weeklyQuestTemplatesRef(db).doc(id).get())
  );

  const quests = templateDocs
    .filter((doc) => doc.exists)
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
      progress: progress.quests[doc.id] ?? { current: 0, target: doc.data().requirementTarget, completed: false, claimed: false },
    }));

  return {
    resetsIn: getWeeklyResetsInLabel(),
    inProgressQuests: quests.filter((q) => !q.progress.claimed),
    claimedQuests: quests.filter((q) => q.progress.claimed),
  };
}

async function getPartnerChallengesForUser(userId) {
  const db = getFirestore();
  const [challengesSnap, progressSnap] = await Promise.all([
    partnerChallengesRef(db).where('active', '==', true).get(),
    userChallengeProgressRef(db, userId).get(),
  ]);

  const progressById = new Map(progressSnap.docs.map((doc) => [doc.id, doc.data()]));
  const now = Date.now();

  const challenges = challengesSnap.docs.map((doc) => {
    const challenge = doc.data();
    const progress = progressById.get(doc.id) ?? null;
    const completionRatePercent =
      challenge.participantCount > 0
        ? Math.round((challenge.completedCount / challenge.participantCount) * 100)
        : 0;

    // Only 'fixed' duration challenges can expire mid-attempt (e.g. "5 days"
    // from when the user started it). Permanent/monthly/event challenges
    // don't expire this way — monthly ones just reset via the scheduled
    // reset instead.
    let isExpired = false;
    if (challenge.durationType === 'fixed' && progress && !progress.completed && !progress.claimed) {
      const startedAtMs = new Date(progress.startedAt).getTime();
      const expiresAtMs = startedAtMs + (challenge.durationDays ?? 0) * 24 * 60 * 60 * 1000;
      isExpired = now > expiresAtMs;
    }

    return { id: doc.id, ...challenge, progress, completionRatePercent, isExpired };
  });

  // "Past" = reward already claimed, or a fixed-duration attempt that ran
  // out of time without completing. Everything else (not started, in
  // progress, or completed-but-not-yet-claimed) is "active".
  const pastChallenges = challenges.filter((c) => c.progress?.claimed || c.isExpired);
  const activeChallenges = challenges.filter((c) => !c.progress?.claimed && !c.isExpired);

  return {
    clearedCount: challenges.filter((c) => c.progress?.claimed).length,
    totalCount: challenges.length,
    activeChallenges,
    pastChallenges,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function startChallenge(userId, challengeId) {
  const db = getFirestore();
  const challengeRef = partnerChallengesRef(db).doc(challengeId);
  const progressRef = userChallengeProgressRef(db, userId).doc(challengeId);

  return db.runTransaction(async (tx) => {
    const [challengeSnap, progressSnap] = await Promise.all([tx.get(challengeRef), tx.get(progressRef)]);

    if (progressSnap.exists) {
      return { ok: true, alreadyStarted: true };
    }
    if (!challengeSnap.exists) {
      return { ok: false, error: 'Challenge not found.' };
    }

    const challenge = challengeSnap.data();
    tx.set(progressRef, {
      current: 0,
      target: challenge.requirementTarget,
      completed: false,
      claimed: false,
      startedAt: new Date().toISOString(),
    });
    tx.update(challengeRef, { participantCount: (challenge.participantCount ?? 0) + 1 });

    return { ok: true, alreadyStarted: false };
  });
}

async function claimDailyQuestReward(userId, templateId) {
  const db = getFirestore();
  const dateId = getDateId();
  const progressRef = userDailyQuestProgressRef(db, userId).doc(dateId);
  const templateRef = dailyQuestTemplatesRef(db).doc(templateId);
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (tx) => {
    const [progressSnap, templateSnap, userSnap] = await Promise.all([
      tx.get(progressRef),
      tx.get(templateRef),
      tx.get(userRef),
    ]);

    if (!progressSnap.exists || !templateSnap.exists) {
      return { ok: false, error: 'Quest or progress not found.' };
    }

    const progress = progressSnap.data();
    const entry = progress.quests[templateId];
    if (!entry) return { ok: false, error: 'Quest not part of today.' };
    if (!entry.completed) return { ok: false, error: 'Quest not completed yet.' };
    if (entry.claimed) return { ok: false, error: 'Reward already claimed.' };

    const template = templateSnap.data();
    const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;

    tx.set(progressRef, { quests: { [templateId]: { ...entry, claimed: true } } }, { merge: true });
    tx.update(userRef, { points: currentPoints + template.points });
    tx.set(userPointsLedgerRef(db, userId).doc(), {
      title: `Completed Daily Quest: ${template.title}`,
      amount: template.points,
      type: 'quest',
      tag: 'Quest',
      icon: 'trophy-outline',
      timestamp: new Date().toISOString(),
    });

    return { ok: true, pointsAwarded: template.points };
  });
}

async function claimWeeklyQuestReward(userId, templateId) {
  const db = getFirestore();
  const weekId = getWeekId();
  const progressRef = userWeeklyQuestProgressRef(db, userId).doc(weekId);
  const templateRef = weeklyQuestTemplatesRef(db).doc(templateId);
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (tx) => {
    const [progressSnap, templateSnap, userSnap] = await Promise.all([
      tx.get(progressRef),
      tx.get(templateRef),
      tx.get(userRef),
    ]);

    if (!progressSnap.exists || !templateSnap.exists) {
      return { ok: false, error: 'Quest or progress not found.' };
    }

    const progress = progressSnap.data();
    const entry = progress.quests[templateId];
    if (!entry) return { ok: false, error: 'Quest not part of this week.' };
    if (!entry.completed) return { ok: false, error: 'Quest not completed yet.' };
    if (entry.claimed) return { ok: false, error: 'Reward already claimed.' };

    const template = templateSnap.data();
    const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;

    tx.set(progressRef, { quests: { [templateId]: { ...entry, claimed: true } } }, { merge: true });
    tx.update(userRef, { points: currentPoints + template.points });
    tx.set(userPointsLedgerRef(db, userId).doc(), {
      title: `Completed Weekly Quest: ${template.title}`,
      amount: template.points,
      type: 'quest',
      tag: 'Quest',
      icon: 'trophy-outline',
      timestamp: new Date().toISOString(),
    });

    return { ok: true, pointsAwarded: template.points };
  });
}

async function claimChallengeReward(userId, challengeId) {
  const db = getFirestore();
  const progressRef = userChallengeProgressRef(db, userId).doc(challengeId);
  const challengeRef = partnerChallengesRef(db).doc(challengeId);
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (tx) => {
    const [progressSnap, challengeSnap, userSnap] = await Promise.all([
      tx.get(progressRef),
      tx.get(challengeRef),
      tx.get(userRef),
    ]);

    if (!progressSnap.exists || !challengeSnap.exists) {
      return { ok: false, error: 'Challenge or progress not found.' };
    }

    const progress = progressSnap.data();
    if (!progress.completed) return { ok: false, error: 'Challenge not completed yet.' };
    if (progress.claimed) return { ok: false, error: 'Reward already claimed.' };

    const challenge = challengeSnap.data();
    const points = challenge.points ?? 0;
    const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;

    tx.update(progressRef, { claimed: true });
    if (points > 0) {
      tx.update(userRef, { points: currentPoints + points });
      tx.set(userPointsLedgerRef(db, userId).doc(), {
        title: `Partner Challenge: ${challenge.merchantName}`,
        amount: points,
        type: 'challenge',
        tag: 'Challenge',
        icon: 'trophy-outline',
        timestamp: new Date().toISOString(),
      });
    }

    return { ok: true, pointsAwarded: points };
  });
}

/**
 * The single integration point the rest of the API should call whenever
 * something quest-relevant happens (a payment, a merchant visit, a bill
 * split). Advances every matching active daily quest, weekly quest, and
 * started partner challenge for this user, in one Firestore transaction.
 *
 * event = {
 *   eventType: 'transaction' | 'merchant_visit' | 'bill_split',
 *   amount, merchantId, merchantCategory, isNewMerchant
 * }
 *
 * Daily quests, weekly quests, and partner challenges all only get marked
 * `completed` here — claiming (and actually receiving the points) is always
 * a separate explicit step (claimDailyQuestReward / claimWeeklyQuestReward /
 * claimChallengeReward above).
 */
async function recordQuestEvent(userId, event) {
  const db = getFirestore();
  const dateId = getDateId();
  const weekId = getWeekId();

  const dailyProgressRef = userDailyQuestProgressRef(db, userId).doc(dateId);
  const weeklyProgressRef = userWeeklyQuestProgressRef(db, userId).doc(weekId);
  const questMetaRef = userQuestMetaRef(db, userId).doc('streak');
  const userRef = db.collection('users').doc(userId);
  const challengeProgressCollection = userChallengeProgressRef(db, userId);

  return db.runTransaction(async (tx) => {
    // ---- 1. READS (all reads before any writes) ----
    const [dailyDoc, weeklyDoc, metaDoc, userDoc, dailyTemplatesSnap, weeklyTemplatesSnap, challengeProgressSnap] =
      await Promise.all([
        tx.get(dailyProgressRef),
        tx.get(weeklyProgressRef),
        tx.get(questMetaRef),
        tx.get(userRef),
        tx.get(dailyQuestTemplatesRef(db)),
        tx.get(weeklyQuestTemplatesRef(db)),
        tx.get(challengeProgressCollection),
      ]);

    const challengeDocs = await Promise.all(
      challengeProgressSnap.docs.map((doc) => tx.get(partnerChallengesRef(db).doc(doc.id)))
    );

    // ---- 2. COMPUTE ----
    const dailyTemplates = new Map(dailyTemplatesSnap.docs.map((d) => [d.id, d.data()]));
    const weeklyTemplates = new Map(weeklyTemplatesSnap.docs.map((d) => [d.id, d.data()]));

    let streakCurrentDays = metaDoc.data()?.streakCurrentDays ?? 0;
    let streakChanged = false;

    if (event.eventType === 'transaction') {
      const lastActiveDateId = metaDoc.data()?.lastActiveDateId;
      if (lastActiveDateId !== dateId) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const wasYesterday = lastActiveDateId === getDateId(yesterday);
        streakCurrentDays = wasYesterday ? streakCurrentDays + 1 : 1;
        streakChanged = true;
      }
    }

    function applyEventToQuest(template, progress) {
      if (progress.completed) return null;

      switch (template.requirementType) {
        case 'transaction_count': {
          if (event.eventType !== 'transaction') return null;
          const category = template.requirementMeta?.category;
          if (category && event.merchantCategory !== category) return null;
          return incrementBy(progress, 1);
        }
        case 'spend_amount': {
          if (event.eventType !== 'transaction' || !event.amount) return null;
          return incrementBy(progress, event.amount);
        }
        case 'visit_new_merchant': {
          if (event.eventType !== 'merchant_visit' || !event.isNewMerchant) return null;
          return incrementBy(progress, 1);
        }
        case 'merchant_category': {
          if (event.eventType !== 'transaction' || !event.merchantCategory) return null;
          const category = template.requirementMeta?.category;
          if (category && event.merchantCategory !== category) return null;
          return incrementBy(progress, 1);
        }
        case 'merchant_category_count': {
          if (event.eventType !== 'transaction' || !event.merchantCategory) return null;
          const visited = new Set(progress.meta?.visitedCategories ?? []);
          if (visited.has(event.merchantCategory)) return null;
          visited.add(event.merchantCategory);
          const current = visited.size;
          return {
            ...progress,
            current,
            completed: current >= progress.target,
            meta: { ...progress.meta, visitedCategories: Array.from(visited) },
          };
        }
        case 'split_bill_count': {
          if (event.eventType !== 'bill_split') return null;
          return incrementBy(progress, 1);
        }
        case 'streak_day': {
          if (event.eventType !== 'transaction') return null;
          const current = Math.min(streakCurrentDays, progress.target);
          return { ...progress, current, completed: current >= progress.target };
        }
        default:
          return null;
      }
    }

    function incrementBy(progress, amount) {
      const current = progress.current + amount;
      return { ...progress, current, completed: current >= progress.target };
    }

    // ---- Daily quests (mark completed only — claiming is a separate step, same as weekly) ----
    let dailyChanged = false;
    const dailyQuests = { ...(dailyDoc.exists ? dailyDoc.data().quests : {}) };
    for (const [templateId, progress] of Object.entries(dailyQuests)) {
      const template = dailyTemplates.get(templateId);
      if (!template) continue;
      const updated = applyEventToQuest(template, progress);
      if (!updated) continue;
      dailyChanged = true;
      dailyQuests[templateId] = updated;
    }

    // ---- Weekly quests (progress only) ----
    let weeklyChanged = false;
    const weeklyQuests = { ...(weeklyDoc.exists ? weeklyDoc.data().quests : {}) };
    for (const [templateId, progress] of Object.entries(weeklyQuests)) {
      const template = weeklyTemplates.get(templateId);
      if (!template) continue;
      const updated = applyEventToQuest(template, progress);
      if (!updated) continue;
      weeklyChanged = true;
      weeklyQuests[templateId] = updated;
    }

    // ---- Partner challenges ----
    const challengeUpdates = [];
    const challengeCompletions = [];
    challengeProgressSnap.docs.forEach((progressDoc, i) => {
      const progress = progressDoc.data();
      if (progress.completed) return;

      const challengeSnap = challengeDocs[i];
      if (!challengeSnap.exists) return;
      const challenge = challengeSnap.data();

      let delta = 0;
      if (challenge.requirementType === 'spend_amount_at_merchant') {
        if (event.eventType === 'transaction' && event.amount && challenge.requirementMeta?.merchantIds?.includes(event.merchantId)) {
          delta = event.amount;
        }
      } else if (
        challenge.requirementType === 'visit_count_at_merchants' ||
        challenge.requirementType === 'visit_stall_count'
      ) {
        if (event.eventType === 'merchant_visit' && challenge.requirementMeta?.merchantIds?.includes(event.merchantId)) {
          delta = 1;
        }
      }

      if (delta === 0) return;
      const newCurrent = progress.current + delta;
      const nowCompleted = newCurrent >= progress.target;
      challengeUpdates.push({ ref: progressDoc.ref, current: newCurrent, completed: nowCompleted });
      if (nowCompleted) {
        challengeCompletions.push({ ref: challengeSnap.ref, completedCount: (challenge.completedCount ?? 0) + 1 });
      }
    });

    // ---- 3. WRITES ----
    if (streakChanged) {
      tx.set(questMetaRef, { streakCurrentDays, lastActiveDateId: dateId }, { merge: true });
    }
    if (dailyChanged) {
      tx.set(dailyProgressRef, { quests: dailyQuests }, { merge: true });
    }
    if (weeklyChanged) {
      tx.set(weeklyProgressRef, { quests: weeklyQuests }, { merge: true });
    }
    challengeUpdates.forEach((u) => tx.update(u.ref, { current: u.current, completed: u.completed }));
    challengeCompletions.forEach((c) => tx.update(c.ref, { completedCount: c.completedCount }));

    return { ok: true };
  });
}

module.exports = {
  getDateId,
  getWeekId,
  getDailyQuestsForUser,
  getWeeklyQuestsForUser,
  getPartnerChallengesForUser,
  startChallenge,
  claimDailyQuestReward,
  claimWeeklyQuestReward,
  claimChallengeReward,
  recordQuestEvent,
};
