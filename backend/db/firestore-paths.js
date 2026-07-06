/**
 * Firestore layout — shared user hub for all tabs.
 *
 * users/{userId}                         profile (tier, points, phone, pin)
 * users/{userId}/cards/{cardId}          Home / Pay
 * users/{userId}/transactions/{txnId}    shared spending (DNA, travel, Payogotchi)
 * users/{userId}/notifications/{id}      Home alerts
 * users/{userId}/rewards/{id}            Rewards tab (team)
 * users/{userId}/payogotchi/{id}         Payogotchi tab (team)
 * users/{userId}/travel/{id}             Travel tab (team)
 */

const USER_SUBCOLLECTIONS = ['cards', 'transactions', 'notifications', 'rewards', 'payogotchi', 'travel'];

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
};
