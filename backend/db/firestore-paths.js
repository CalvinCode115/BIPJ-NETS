/**
 * Firestore layout — shared user hub for all tabs.
 *
 * users/{userId}                              profile (tier, points, phone, pin)
 * users/{userId}/cards/{cardId}                Home / Pay
 * users/{userId}/transactions/{txnId}          shared spending (DNA, travel, Payogotchi)
 * users/{userId}/notifications/{id}            Home alerts
 * users/{userId}/rewards/{id}                  Rewards tab (team)
 * users/{userId}/payogotchi/{id}                Payogotchi tab (team)
 * users/{userId}/travel/{id}                   Travel tab (team)
 *
 * ---- Quests & Partner Challenges (added) ----
 * dailyQuestTemplates/{templateId}             15 daily quest definitions (admin/seed managed)
 * weeklyQuestTemplates/{templateId}             10 weekly quest definitions (admin/seed managed)
 * dailyQuestRotations/{dateId}                 today's 4-5 assigned quest IDs (dateId = YYYY-MM-DD, Asia/Singapore)
 * weeklyQuestRotations/{weekId}                this week's 3 assigned quest IDs (weekId = YYYY-Www, Asia/Singapore)
 * partnerChallenges/{challengeId}              merchant challenge definitions (admin managed)
 * users/{userId}/dailyQuestProgress/{dateId}   per-user progress on today's daily quests
 * users/{userId}/weeklyQuestProgress/{weekId}  per-user progress on this week's weekly quests
 * users/{userId}/challengeProgress/{challengeId}  per-user progress on a partner challenge
 * users/{userId}/questMeta/streak              per-user streak tracking (for streak_day quests)
 */

const USER_SUBCOLLECTIONS = [
  'cards',
  'transactions',
  'notifications',
  'rewards',
  'payogotchi',
  'travel',
  'dailyQuestProgress',
  'weeklyQuestProgress',
  'challengeProgress',
  'questMeta',
];

function userRef(db, userId) {
  return db.collection('users').doc(userId);
}

function userCardsRef(db, userId) {
  return userRef(db, userId).collection('cards');
}

function userTransactionsRef(db, userId) {
  return userRef(db, userId).collection('transactions');
}

function userNotificationsRef(db, userId) {
  return userRef(db, userId).collection('notifications');
}

function userRewardsRef(db, userId) {
  return userRef(db, userId).collection('rewards');
}

function userPayogotchiRef(db, userId) {
  return userRef(db, userId).collection('payogotchi');
}

function userTravelRef(db, userId) {
  return userRef(db, userId).collection('travel');
}

function appMetaRef(db) {
  return db.collection('app_meta').doc('seed');
}

// ---- Quests & Partner Challenges ----

function dailyQuestTemplatesRef(db) {
  return db.collection('dailyQuestTemplates');
}

function weeklyQuestTemplatesRef(db) {
  return db.collection('weeklyQuestTemplates');
}

function dailyQuestRotationsRef(db) {
  return db.collection('dailyQuestRotations');
}

function weeklyQuestRotationsRef(db) {
  return db.collection('weeklyQuestRotations');
}

function partnerChallengesRef(db) {
  return db.collection('partnerChallenges');
}

function userDailyQuestProgressRef(db, userId) {
  return userRef(db, userId).collection('dailyQuestProgress');
}

function userWeeklyQuestProgressRef(db, userId) {
  return userRef(db, userId).collection('weeklyQuestProgress');
}

function userChallengeProgressRef(db, userId) {
  return userRef(db, userId).collection('challengeProgress');
}

function userQuestMetaRef(db, userId) {
  return userRef(db, userId).collection('questMeta');
}

module.exports = {
  USER_SUBCOLLECTIONS,
  userRef,
  userCardsRef,
  userTransactionsRef,
  userNotificationsRef,
  userRewardsRef,
  userPayogotchiRef,
  userTravelRef,
  appMetaRef,
  dailyQuestTemplatesRef,
  weeklyQuestTemplatesRef,
  dailyQuestRotationsRef,
  weeklyQuestRotationsRef,
  partnerChallengesRef,
  userDailyQuestProgressRef,
  userWeeklyQuestProgressRef,
  userChallengeProgressRef,
  userQuestMetaRef,
};
