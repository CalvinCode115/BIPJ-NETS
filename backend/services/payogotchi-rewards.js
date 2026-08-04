const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');

/**
 * NETS Points bonus for reaching a given Tapatchi level. Deliberately much
 * smaller than transaction points (10/$1 — see transaction-rewards.js):
 * these are meant to be hard to earn, a rare milestone reward rather than
 * a second way to farm the points economy. Scales up as levels get harder
 * to reach; level 50 is the current final level, so it (and anything past
 * it, in case the level cap changes later) gets the top bonus.
 */
function levelUpBonus(level) {
  if (level <= 10) return 5;
  if (level <= 20) return 10;
  if (level <= 25) return 15;
  if (level <= 30) return 20;
  if (level <= 35) return 30;
  if (level <= 40) return 40;
  if (level <= 49) return 50;
  return 100; // level 50+
}

const EVOLVE_BONUS = 100;

// Same get -> add -> write-ledger-entry shape as transaction-rewards.js /
// quests.js use elsewhere for crediting the real points balance.
async function creditPoints(db, userId, amount, title) {
  if (!(amount > 0)) {
    return 0;
  }
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;

  await userRef.update({ points: currentPoints + amount });
  await userPointsLedgerRef(db, userId).doc().set({
    title,
    amount,
    type: 'bonus',
    tag: 'Payogotchi',
    icon: 'paw-outline',
    timestamp: new Date().toISOString(),
  });
  return amount;
}

/**
 * Awards real NETS Points for a Tapatchi level-up and/or evolution — called
 * by the Payogotchi client right after PetService reports the milestone on
 * a real XP grant (a transaction or the tutorial completion bonus). Never
 * throws: a failure here shouldn't undo the pet's own state, which the
 * client already applied and persisted separately.
 *
 * `fromLevel`/`toLevel` let a single XP grant that crosses more than one
 * level at once collect a bonus for every level actually reached, not just
 * the final one (rare in practice — XP caps make it hard to jump levels —
 * but the tutorial's flat 100 XP bonus could do it early on).
 */
async function awardPetMilestone(userId, { fromLevel, toLevel, evolved, newStage } = {}) {
  try {
    const db = getFirestore();
    let pointsAwarded = 0;

    if (typeof fromLevel === 'number' && typeof toLevel === 'number' && toLevel > fromLevel) {
      for (let level = fromLevel + 1; level <= toLevel; level++) {
        pointsAwarded += await creditPoints(db, userId, levelUpBonus(level), `Tapatchi reached Level ${level}`);
      }
    }

    if (evolved) {
      const title = newStage ? `Tapatchi evolved to ${newStage}` : 'Tapatchi evolved';
      pointsAwarded += await creditPoints(db, userId, EVOLVE_BONUS, title);
    }

    return { pointsAwarded };
  } catch (err) {
    console.error('awardPetMilestone failed:', err);
    return { pointsAwarded: 0, error: true };
  }
}

module.exports = { awardPetMilestone, levelUpBonus, EVOLVE_BONUS };
