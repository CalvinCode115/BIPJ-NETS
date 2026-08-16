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
  voucherCatalogRef,
  userVouchersRef,
  userBadgesRef,
} = require('../db/firestore-paths');
const { getTodaysPointsBudget } = require('./points-budget');
const { capBalanceAward } = require('./points-balance-cap');
// Payogotchi-owned (Calvin). Queues the pet half of a reward — "+100 XP",
// "+5 Pet Happiness" — for PetService to apply on next open. Pure writes,
// same contract as grantBadges() below.
const { queuePetReward } = require('./payogotchi-progress');

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

/**
 * Picks up to `count` templates for a rotation, preferring:
 *
 *   1. Templates NOT in `excludeIds` — avoids repeating the immediately
 *      preceding day's/week's picks. Falls back to including them anyway
 *      only if excluding them would leave too few templates to fill the
 *      rotation (shouldn't happen with the current template counts).
 *
 *   2. At most ONE template per `family` — so a single day/week doesn't
 *      end up with two near-duplicate quests (e.g. both Big Spender and
 *      Mid-Range Spender, which are the same "spend $X" mechanic at two
 *      different thresholds). Templates without a `family` tag are
 *      treated as their own unique family.
 */
function pickDiverseRotation(templates, count, excludeIds = new Set()) {
  const preferred = templates.filter((t) => !excludeIds.has(t.id));
  const pool = preferred.length >= count ? preferred : templates;

  const byFamily = new Map();
  for (const t of pool) {
    const family = t.family || t.id;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(t);
  }

  const shuffledFamilies = [...byFamily.keys()].sort(() => Math.random() - 0.5);
  const picked = [];
  for (const family of shuffledFamilies) {
    if (picked.length >= count) break;
    const options = byFamily.get(family);
    picked.push(options[Math.floor(Math.random() * options.length)]);
  }

  // Safety net: only kicks in if there aren't enough distinct families to
  // fill the rotation (not the case with the current template set, but
  // this keeps the function correct if templates are added/removed later).
  if (picked.length < count) {
    const pickedIds = new Set(picked.map((t) => t.id));
    const remaining = pool.filter((t) => !pickedIds.has(t.id)).sort(() => Math.random() - 0.5);
    while (picked.length < count && remaining.length) {
      picked.push(remaining.shift());
    }
  }

  return picked.map((t) => t.id);
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
  const templates = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Avoid repeating yesterday's picks where possible.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySnap = await dailyQuestRotationsRef(db).doc(getDateId(yesterday)).get();
  const excludeIds = new Set(yesterdaySnap.exists ? yesterdaySnap.data().questTemplateIds ?? [] : []);

  const size = randomBetween(DAILY_ROTATION_MIN, DAILY_ROTATION_MAX);
  const questTemplateIds = pickDiverseRotation(templates, size, excludeIds);

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
  const templates = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Avoid repeating last week's picks where possible.
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekSnap = await weeklyQuestRotationsRef(db).doc(getWeekId(lastWeek)).get();
  const excludeIds = new Set(lastWeekSnap.exists ? lastWeekSnap.data().questTemplateIds ?? [] : []);

  const questTemplateIds = pickDiverseRotation(templates, WEEKLY_ROTATION_SIZE, excludeIds);

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

    // 'fixed' challenges expire per-user, timed from when THEY started.
    // 'event' challenges expire for EVERYONE at the same absolute date,
    // whether or not the user ever started it — this was missing before,
    // which is why an event challenge like National Day never moved to
    // Past Challenges after its date passed.
    let isExpired = false;
    if (challenge.durationType === 'fixed' && progress && !progress.completed && !progress.claimed) {
      const startedAtMs = new Date(progress.startedAt).getTime();
      const expiresAtMs = startedAtMs + (challenge.durationDays ?? 0) * 24 * 60 * 60 * 1000;
      isExpired = now > expiresAtMs;
    } else if (challenge.durationType === 'event' && challenge.eventEndDate && !progress?.completed) {
      // Only counts as expired if the user DIDN'T finish in time — if they
      // completed it before the event ended, they keep the ability to
      // claim later even after the date passes.
      const eventEndMs = new Date(challenge.eventEndDate).getTime();
      isExpired = now > eventEndMs;
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

/**
 * Writes a badge doc for every 'badge'-style reward in `rewards`, keyed by
 * a slug of the label so re-earning the same badge (e.g. a weekly quest
 * rotating back in a future week) doesn't create a duplicate — just
 * refreshes it. Pure writes, no reads, so it's safe to call from anywhere
 * inside an existing transaction regardless of read/write ordering so far.
 */
function grantBadges(tx, db, userId, rewards, sourceType, sourceLabel) {
  (rewards ?? []).forEach((reward) => {
    if (reward.style !== 'badge') return;
    const badgeId = reward.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    tx.set(
      userBadgesRef(db, userId).doc(badgeId),
      { label: reward.label, sourceType, sourceLabel, earnedAt: new Date().toISOString() },
      { merge: true }
    );
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

    // ---- Daily points cap — shared across all reward sources. The quest
    // still gets marked claimed (and badges still granted) even if capped
    // to 0 points, so it never gets permanently stuck unclaimable. ----
    const { pointsRemaining } = await getTodaysPointsBudget(db, userId, tx);
    const pointsAwarded = capBalanceAward(currentPoints, Math.min(template.points, pointsRemaining));

    tx.set(progressRef, { quests: { [templateId]: { ...entry, claimed: true } } }, { merge: true });
    if (pointsAwarded > 0) {
      tx.update(userRef, { points: currentPoints + pointsAwarded });
      tx.set(userPointsLedgerRef(db, userId).doc(), {
        title: `Completed Daily Quest: ${template.title}`,
        amount: pointsAwarded,
        type: 'quest',
        tag: 'Quest',
        icon: 'trophy-outline',
        timestamp: new Date().toISOString(),
      });
    }
    grantBadges(tx, db, userId, template.rewards, 'daily', template.title);
    queuePetReward(tx, db, userId, template.rewards, 'daily', template.title);

    return { ok: true, pointsAwarded };
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

    const { pointsRemaining } = await getTodaysPointsBudget(db, userId, tx);
    const pointsAwarded = capBalanceAward(currentPoints, Math.min(template.points, pointsRemaining));

    tx.set(progressRef, { quests: { [templateId]: { ...entry, claimed: true } } }, { merge: true });
    if (pointsAwarded > 0) {
      tx.update(userRef, { points: currentPoints + pointsAwarded });
      tx.set(userPointsLedgerRef(db, userId).doc(), {
        title: `Completed Weekly Quest: ${template.title}`,
        amount: pointsAwarded,
        type: 'quest',
        tag: 'Quest',
        icon: 'trophy-outline',
        timestamp: new Date().toISOString(),
      });
    }
    grantBadges(tx, db, userId, template.rewards, 'weekly', template.title);
    queuePetReward(tx, db, userId, template.rewards, 'weekly', template.title);

    return { ok: true, pointsAwarded };
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
    const { pointsRemaining } = await getTodaysPointsBudget(db, userId, tx);
    const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;
    const pointsAwarded = capBalanceAward(currentPoints, Math.min(challenge.points ?? 0, pointsRemaining));

    // ---- Read the voucher catalog entry BEFORE any writes, if this
    // challenge grants a real voucher (Firestore transactions require all
    // reads before any writes) ----
    let voucherCatalogSnap = null;
    if (challenge.grantVoucherId) {
      voucherCatalogSnap = await tx.get(voucherCatalogRef(db).doc(challenge.grantVoucherId));
    }

    tx.update(progressRef, { claimed: true });
    if (pointsAwarded > 0) {
      tx.update(userRef, { points: currentPoints + pointsAwarded });
      tx.set(userPointsLedgerRef(db, userId).doc(), {
        title: `Partner Challenge: ${challenge.merchantName}`,
        amount: pointsAwarded,
        type: 'challenge',
        tag: 'Challenge',
        icon: 'trophy-outline',
        timestamp: new Date().toISOString(),
      });
    }

    // ---- Grant the real voucher, same shape as a Marketplace redemption
    // (so it auto-applies at payment and shows up in My Vouchers exactly
    // the same way) — just free instead of costing points, and tagged
    // `source: 'challenge'` so it's distinguishable from a real purchase. ----
    let voucherGranted = false;
    if (voucherCatalogSnap && voucherCatalogSnap.exists) {
      const voucher = voucherCatalogSnap.data();
      const redeemedAt = new Date();
      const expiresAt = new Date(redeemedAt.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);

      tx.set(userVouchersRef(db, userId).doc(), {
        voucherId: challenge.grantVoucherId,
        merchantName: voucher.merchantName,
        description: voucher.description,
        icon: voucher.icon ?? 'gift-outline',
        pointsCost: 0,
        source: 'challenge',
        sourceLabel: challenge.merchantName, // shown in My Vouchers instead of "0 Points" for challenge-granted vouchers
        redeemedAt: redeemedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: 'available',
        usedAt: null,
        usedMerchant: null,
        usedLocation: null,
        termsAndConditions: voucher.termsAndConditions ?? [],
        usageSteps: voucher.usageSteps ?? [],
      });
      voucherGranted = true;
    }

    grantBadges(tx, db, userId, challenge.rewards, 'challenge', challenge.merchantName);
    queuePetReward(tx, db, userId, challenge.rewards, 'challenge', challenge.merchantName);

    return { ok: true, pointsAwarded, voucherGranted };
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
    const [dailyDoc, weeklyDoc, metaDoc, userDoc, dailyTemplatesSnap, weeklyTemplatesSnap, challengeProgressSnap, dailyRotationDoc, weeklyRotationDoc] =
      await Promise.all([
        tx.get(dailyProgressRef),
        tx.get(weeklyProgressRef),
        tx.get(questMetaRef),
        tx.get(userRef),
        tx.get(dailyQuestTemplatesRef(db)),
        tx.get(weeklyQuestTemplatesRef(db)),
        tx.get(challengeProgressCollection),
        tx.get(dailyQuestRotationsRef(db).doc(dateId)),
        tx.get(weeklyQuestRotationsRef(db).doc(weekId)),
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

    /** requirementMeta.category can be a single string or an array — matches either. */
    function categoryMatches(requirementMeta, eventCategory) {
      const categories = requirementMeta?.category;
      if (!categories) return true; // no category restriction on this quest
      const list = Array.isArray(categories) ? categories : [categories];
      return list.includes(eventCategory);
    }

    /** requirementMeta.hourRange: [startHour, endHour) in Asia/Singapore, 24h clock. */
    function withinHourRange(requirementMeta) {
      if (!requirementMeta?.hourRange) return true; // no time restriction
      const [startHour, endHour] = requirementMeta.hourRange;
      const hour = toSgtWallClock().getUTCHours();
      if (startHour <= endHour) {
        return hour >= startHour && hour < endHour;
      }
      return hour >= startHour || hour < endHour; // wraps past midnight
    }

    function applyEventToQuest(template, progress) {
      if (progress.completed) return null;

      switch (template.requirementType) {
        case 'transaction_count': {
          if (event.eventType !== 'transaction') return null;
          if (!categoryMatches(template.requirementMeta, event.merchantCategory)) return null;
          if (!withinHourRange(template.requirementMeta)) return null;
          return incrementBy(progress, 1);
        }
        case 'spend_amount': {
          if (event.eventType !== 'transaction' || !event.amount) return null;
          return incrementBy(progress, event.amount);
        }
        case 'transaction_under_amount': {
          // A single qualifying transaction completes this instantly — NOT
          // cumulative like 'spend_amount'. e.g. Penny Saver: "a transaction
          // under $5", not "your total spend today reaches $5".
          if (event.eventType !== 'transaction' || event.amount === undefined) return null;
          const maxAmount = template.requirementMeta?.maxAmount;
          if (maxAmount !== undefined && event.amount >= maxAmount) return null;
          if (!categoryMatches(template.requirementMeta, event.merchantCategory)) return null;
          if (!withinHourRange(template.requirementMeta)) return null;
          return incrementBy(progress, 1);
        }
        case 'visit_new_merchant': {
          const isVisitLikeEvent = event.eventType === 'transaction' || event.eventType === 'merchant_visit';
          if (!isVisitLikeEvent || !event.isNewMerchant) return null;
          return incrementBy(progress, 1);
        }
        case 'merchant_category': {
          if (event.eventType !== 'transaction' || !event.merchantCategory) return null;
          if (!categoryMatches(template.requirementMeta, event.merchantCategory)) return null;
          return incrementBy(progress, 1);
        }
        case 'merchant_category_count': {
          if (event.eventType !== 'transaction' || !event.merchantCategory) return null;

          // Optional per-quest category collapsing/allowlisting — e.g.
          // Diverse Spender treats Coffee and Drinks as Dining, and only
          // counts 5 broad categories total.
          const aliases = template.requirementMeta?.categoryAliases ?? {};
          const canonicalCategory = aliases[event.merchantCategory] ?? event.merchantCategory;
          const allowedCategories = template.requirementMeta?.allowedCategories;
          if (allowedCategories && !allowedCategories.includes(canonicalCategory)) return null;

          const visited = new Set(progress.meta?.visitedCategories ?? []);
          if (visited.has(canonicalCategory)) return null; // already counted
          visited.add(canonicalCategory);
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
    // Self-heals any quest in today's rotation that doesn't have a progress
    // entry yet — this happens if a transaction fires before the user has
    // ever opened the Daily Quests page for this rotation. Without this,
    // the event silently has nothing to attach to and does nothing.
    let dailyChanged = false;
    const dailyQuests = { ...(dailyDoc.exists ? dailyDoc.data().quests : {}) };
    const dailyRotationIds = dailyRotationDoc.exists ? dailyRotationDoc.data().questTemplateIds ?? [] : [];
    for (const templateId of dailyRotationIds) {
      if (dailyQuests[templateId]) continue;
      const template = dailyTemplates.get(templateId);
      if (!template) continue;
      dailyQuests[templateId] = { current: 0, target: template.requirementTarget, completed: false, claimed: false };
      dailyChanged = true;
    }
    for (const [templateId, progress] of Object.entries(dailyQuests)) {
      const template = dailyTemplates.get(templateId);
      if (!template) continue;
      const updated = applyEventToQuest(template, progress);
      if (!updated) continue;
      dailyChanged = true;
      dailyQuests[templateId] = updated;
    }

    // ---- Weekly quests (progress only) ----
    // Same self-healing as daily, for the same reason.
    let weeklyChanged = false;
    const weeklyQuests = { ...(weeklyDoc.exists ? weeklyDoc.data().quests : {}) };
    const weeklyRotationIds = weeklyRotationDoc.exists ? weeklyRotationDoc.data().questTemplateIds ?? [] : [];
    for (const templateId of weeklyRotationIds) {
      if (weeklyQuests[templateId]) continue;
      const template = weeklyTemplates.get(templateId);
      if (!template) continue;
      weeklyQuests[templateId] = { current: 0, target: template.requirementTarget, completed: false, claimed: false };
      weeklyChanged = true;
    }
    for (const [templateId, progress] of Object.entries(weeklyQuests)) {
      const template = weeklyTemplates.get(templateId);
      if (!template) continue;
      const updated = applyEventToQuest(template, progress);
      if (!updated) continue;
      weeklyChanged = true;
      weeklyQuests[templateId] = updated;
    }

    /** requirementMeta.merchantIds may contain the literal 'any' as a wildcard (e.g. National Day challenge). */
    function merchantMatches(requirementMeta, eventMerchantId) {
      const ids = requirementMeta?.merchantIds ?? [];
      if (ids.includes('any')) return true;
      return !!eventMerchantId && ids.includes(eventMerchantId);
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

      if (challenge.requirementType === 'spend_amount_at_merchant') {
        if (event.eventType !== 'transaction' || !event.amount) return;
        if (!merchantMatches(challenge.requirementMeta, event.merchantId)) return;

        const newCurrent = progress.current + event.amount;
        const nowCompleted = newCurrent >= progress.target;
        challengeUpdates.push({ ref: progressDoc.ref, current: newCurrent, completed: nowCompleted });
        if (nowCompleted) {
          challengeCompletions.push({ ref: challengeSnap.ref, completedCount: (challenge.completedCount ?? 0) + 1 });
        }
        return;
      }

      if (challenge.requirementType === 'visit_count_at_merchants' || challenge.requirementType === 'visit_stall_count') {
        // A transaction at the merchant counts as a visit — this integration
        // has no separate "check in" action.
        const isVisitLikeEvent = event.eventType === 'merchant_visit' || event.eventType === 'transaction';
        if (!isVisitLikeEvent || !merchantMatches(challenge.requirementMeta, event.merchantId)) return;

        // Track DISTINCT merchants visited, not raw visit count — otherwise
        // 3 trips to the same cafe would wrongly complete a "visit 5
        // different cafes" challenge.
        const visitedMerchants = new Set(progress.meta?.visitedMerchants ?? []);
        if (visitedMerchants.has(event.merchantId)) return; // already counted this merchant
        visitedMerchants.add(event.merchantId);

        const newCurrent = visitedMerchants.size;
        const nowCompleted = newCurrent >= progress.target;
        challengeUpdates.push({
          ref: progressDoc.ref,
          current: newCurrent,
          completed: nowCompleted,
          meta: { visitedMerchants: Array.from(visitedMerchants) },
        });
        if (nowCompleted) {
          challengeCompletions.push({ ref: challengeSnap.ref, completedCount: (challenge.completedCount ?? 0) + 1 });
        }
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
    challengeUpdates.forEach((u) => {
      const data = { current: u.current, completed: u.completed };
      if (u.meta) data.meta = u.meta;
      tx.update(u.ref, data);
    });
    challengeCompletions.forEach((c) => tx.update(c.ref, { completedCount: c.completedCount }));

    return { ok: true };
  });
}

/**
 * Every badge earnable across the whole system (daily quests, weekly
 * quests, partner challenges), cross-referenced against what this user has
 * actually earned — so the Badges page can show locked placeholders for
 * ones not yet earned, not just a list of what you have.
 */
async function getBadgesForUser(userId) {
  const db = getFirestore();
  const [dailySnap, weeklySnap, challengesSnap, earnedSnap] = await Promise.all([
    dailyQuestTemplatesRef(db).get(),
    weeklyQuestTemplatesRef(db).get(),
    partnerChallengesRef(db).get(),
    userBadgesRef(db, userId).get(),
  ]);

  const allBadges = new Map(); // label -> { label, sourceType, sourceLabel }

  function collect(snap, sourceType, nameField) {
    snap.docs.forEach((doc) => {
      const data = doc.data();
      const sourceLabel = data[nameField];
      (data.rewards ?? []).forEach((reward) => {
        if (reward.style !== 'badge') return;
        if (allBadges.has(reward.label)) return; // first source wins for display purposes
        allBadges.set(reward.label, { label: reward.label, sourceType, sourceLabel });
      });
    });
  }

  collect(dailySnap, 'daily', 'title');
  collect(weeklySnap, 'weekly', 'title');
  collect(challengesSnap, 'challenge', 'merchantName');

  const earnedByLabel = new Map(earnedSnap.docs.map((d) => [d.data().label, d.data()]));

  const badges = Array.from(allBadges.values()).map((b) => {
    const earned = earnedByLabel.get(b.label);
    return {
      ...b,
      earned: !!earned,
      earnedAt: earned?.earnedAt ?? null,
    };
  });

  // Earned first (most recent first), then locked ones.
  badges.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned && b.earned) return new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime();
    return a.label.localeCompare(b.label);
  });

  return {
    badges,
    earnedCount: badges.filter((b) => b.earned).length,
    totalCount: badges.length,
  };
}

module.exports = {
  getDateId,
  getWeekId,
  getDailyQuestsForUser,
  getWeeklyQuestsForUser,
  getPartnerChallengesForUser,
  getBadgesForUser,
  startChallenge,
  claimDailyQuestReward,
  claimWeeklyQuestReward,
  claimChallengeReward,
  recordQuestEvent,
};
