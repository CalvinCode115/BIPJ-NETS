const { getFirestore } = require('../firebase/admin');
const { userPetRewardQueueRef } = require('../db/firestore-paths');

/**
 * Rewards → Payogotchi.
 *
 * Several of Yunen's quests and challenges promise pet rewards ("+100 XP",
 * "+5 Pet Happiness") alongside their NETS Points. Until now only the points
 * half actually applied; the pet half was text on a card that did nothing.
 *
 * Why a QUEUE instead of writing the pet document directly:
 * the pet is client-authoritative — PetService owns XP, levelling, stage
 * evolution and the celebration chain, and it overwrites the pet doc on its
 * next save. If the backend added XP straight to Firestore, PetService would
 * clobber it, no level-up would be detected, and nothing would celebrate.
 * So a claim only ever RECORDS what the pet is owed; the client drains the
 * queue on next open and applies it through the same addXp() path a real
 * transaction uses, which gets level-up/evolution detection for free.
 *
 * Mirrors grantBadges() in quests.js: pure writes, no reads, so it's safe to
 * call from anywhere inside an existing Firestore transaction.
 */

// Yunen's reward templates carry the amount inside the human-readable label
// ("+100 XP", "+5 Pet Happiness") rather than a numeric field, so we parse it
// out. Deliberately strict: anything that doesn't match a known shape is
// ignored rather than guessed at, so a new reward style can't silently grant
// the pet a wrong amount.
const XP_LABEL = /^\+(\d+)\s*XP$/i;
const HAPPINESS_LABEL = /^\+(\d+)\s*Pet Happiness$/i;

/**
 * Reads a rewards array and returns the pet's share of it.
 * Returns null when there's nothing for the pet, so callers can skip cleanly.
 *
 * Styles handled:
 *   'xp'   -> "+100 XP"            -> { xp: 100 }
 *   'pet'  -> "+5 Pet Happiness"   -> { happiness: 5 }
 * Styles deliberately NOT handled yet:
 *   'rare' / 'legendary' -> cosmetic unlocks. Payogotchi has no cosmetics
 *     inventory yet (cosmetics-dressup is still a scaffold), so there is
 *     nothing to grant. Left out entirely rather than queued-and-dropped,
 *     so nothing silently disappears; wire it up when cosmetics exist.
 *   'buff' -> "[Buff] Energized". No buff system on the pet either.
 *   'badge' / 'voucher' -> already handled on the Rewards side.
 */
function extractPetReward(rewards) {
  let xp = 0;
  let happiness = 0;

  (rewards ?? []).forEach((reward) => {
    const label = (reward?.label ?? '').trim();

    if (reward?.style === 'xp') {
      const match = label.match(XP_LABEL);
      if (match) xp += Number(match[1]);
      return;
    }

    if (reward?.style === 'pet') {
      const match = label.match(HAPPINESS_LABEL);
      if (match) happiness += Number(match[1]);
    }
  });

  if (xp <= 0 && happiness <= 0) {
    return null;
  }
  return { xp, happiness };
}

/**
 * Queues the pet's share of a claimed reward. Call from inside the claim's
 * existing transaction, right next to grantBadges():
 *
 *   grantBadges(tx, db, userId, template.rewards, 'daily', template.title);
 *   queuePetReward(tx, db, userId, template.rewards, 'daily', template.title);
 *
 * `sourceType` / `sourceLabel` are carried through purely so the client can
 * say "+100 XP from Diverse Spender" when it celebrates.
 */
function queuePetReward(tx, db, userId, rewards, sourceType, sourceLabel) {
  const petReward = extractPetReward(rewards);
  if (!petReward) {
    return null;
  }

  tx.set(userPetRewardQueueRef(db, userId).doc(), {
    ...petReward,
    sourceType,
    sourceLabel,
    queuedAt: new Date().toISOString(),
  });

  return petReward;
}

/**
 * Everything the pet is owed but hasn't applied yet. The client calls this on
 * open, applies each grant through PetService, then acks the ids it applied.
 */
async function listPendingPetRewards(userId) {
  const db = getFirestore();
  const snap = await userPetRewardQueueRef(db, userId).orderBy('queuedAt').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Deletes the grants the client has confirmed it applied.
 *
 * Ack-after-apply rather than delete-on-read: if the app dies between
 * fetching and applying, the grant is still queued and simply arrives next
 * time. The tradeoff is that a client which applies but dies before acking
 * would double-grant on next open — much rarer, and far less bad than
 * silently losing XP the user has already been told they earned.
 */
async function ackPetRewards(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { acked: 0 };
  }

  const db = getFirestore();
  const queue = userPetRewardQueueRef(db, userId);
  const batch = db.batch();
  ids.forEach((id) => batch.delete(queue.doc(String(id))));
  await batch.commit();

  return { acked: ids.length };
}

module.exports = {
  queuePetReward,
  extractPetReward,
  listPendingPetRewards,
  ackPetRewards,
};
