const { getFirestore } = require('../firebase/admin');
const { userPointsLedgerRef } = require('../db/firestore-paths');
const { getTodaysPointsBudget } = require('./points-budget');
const { capBalanceAward } = require('./points-balance-cap');

/**
 * NETS Points bonus for reaching a given Tapatchi level. Deliberately much
 * smaller than transaction points (1/$1 — see transaction-rewards.js):
 * these are meant to be a rare milestone reward, not a second way to farm
 * the points economy. Scales up as levels get harder to reach; level 50 is
 * the current final level, so it (and anything past it, in case the level
 * cap changes later) gets the top bonus.
 *
 * Rebalanced 2026-08-16. The original scale (5/10/15/20/30/40/50/100, evolve
 * 100) was picked when spending paid 10 points per dollar. When that dropped
 * to 1/$1, these bonuses didn't move, so they silently went from ~1% of a
 * user's lifetime points to ~10% — roughly 10x more generous than designed.
 * Halving them restores the intent: a full level-1-to-50 run is now worth
 * 602 points against ~12,250 from the spending it takes to get there (~4.7%).
 *
 * The floor of 3 is deliberate: a straight /10 would pay 1 point for every
 * level from 2 to 20, and nineteen consecutive "+1 NETS Point" celebrations
 * read as broken rather than rare.
 *
 * MIRRORED in src/app/services/pet.service.ts — keep both in sync if either
 * changes, or the UI will promise a different number than the backend grants.
 */
function levelUpBonus(level) {
  if (level <= 10) return 3;
  if (level <= 20) return 5;
  if (level <= 25) return 6;
  if (level <= 30) return 8;
  if (level <= 35) return 12;
  if (level <= 40) return 15;
  if (level <= 49) return 20;
  return 40; // level 50+
}

// Baby -> Teen (level 16) and Teen -> Adult (level 36); twice per lifetime.
// Kept at 17% of the 300/day shared points cap so a big moment rarely
// arrives clipped by the daily budget (see awardPetMilestone below).
const EVOLVE_BONUS = 50;

/**
 * Expands one XP grant into the individual milestones it earned, each with
 * its own ledger title. A single grant can cross more than one level at
 * once (rare — XP caps make it hard — but the tutorial's flat 100 XP bonus
 * can do it early on), and we want the ledger to show every level reached
 * rather than one lumped entry.
 */
function buildMilestones({ fromLevel, toLevel, evolved, newStage }) {
  const milestones = [];

  if (typeof fromLevel === 'number' && typeof toLevel === 'number' && toLevel > fromLevel) {
    for (let level = fromLevel + 1; level <= toLevel; level++) {
      milestones.push({
        amount: levelUpBonus(level),
        title: `Tapatchi reached Level ${level}`,
      });
    }
  }

  if (evolved) {
    milestones.push({
      amount: EVOLVE_BONUS,
      title: newStage ? `Tapatchi evolved to ${newStage}` : 'Tapatchi evolved',
    });
  }

  return milestones;
}

/**
 * Awards real NETS Points for a Tapatchi level-up and/or evolution — called
 * by the Payogotchi client right after PetService reports the milestone on
 * a real XP grant (a transaction or the tutorial completion bonus). Never
 * throws: a failure here shouldn't undo the pet's own state, which the
 * client already applied and persisted separately.
 *
 * Subject to the SAME two caps every other points source respects (see
 * points-budget.js / points-balance-cap.js): the 300-points-per-day shared
 * earning cap, and the 5000-point maximum balance. Milestones are logged as
 * type 'bonus', so they count toward the daily points cap but NOT toward
 * the 20-transactions-per-day cap — a pet milestone isn't a spend.
 *
 * Runs inside a Firestore transaction so a milestone landing at the same
 * moment as a quest claim or a payment can't race it past the cap. All
 * reads happen before any write, as Firestore requires.
 */
async function awardPetMilestone(userId, { fromLevel, toLevel, evolved, newStage } = {}) {
  try {
    const db = getFirestore();
    const milestones = buildMilestones({ fromLevel, toLevel, evolved, newStage });
    const requested = milestones.reduce((sum, milestone) => sum + milestone.amount, 0);

    if (requested <= 0) {
      return { pointsAwarded: 0, requested: 0, capped: false };
    }

    const userRef = db.collection('users').doc(userId);

    return await db.runTransaction(async (tx) => {
      // ---- reads first ----
      const userSnap = await tx.get(userRef);
      const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;
      const { pointsRemaining } = await getTodaysPointsBudget(db, userId, tx);

      // Daily earning cap first, then the max-balance ceiling — same order
      // and same helpers quests.js uses for a quest/challenge claim.
      let budget = capBalanceAward(currentPoints, Math.min(requested, pointsRemaining));

      // ---- writes ----
      // Spend the allowed budget across milestones in order, so an early
      // level still gets its ledger entry when a multi-level jump only
      // partially fits under the cap.
      let pointsAwarded = 0;
      for (const milestone of milestones) {
        if (budget <= 0) break;
        const amount = Math.min(milestone.amount, budget);
        budget -= amount;
        pointsAwarded += amount;

        tx.set(userPointsLedgerRef(db, userId).doc(), {
          title: milestone.title,
          amount,
          type: 'bonus',
          tag: 'Payogotchi',
          icon: 'paw-outline',
          timestamp: new Date().toISOString(),
        });
      }

      if (pointsAwarded > 0) {
        tx.update(userRef, { points: currentPoints + pointsAwarded });
      }

      // `capped` lets the client tell "you earned less than the pet showed"
      // apart from "you earned nothing" — the pet's own XP/level is
      // unaffected either way, only the points half of the reward is capped.
      return { pointsAwarded, requested, capped: pointsAwarded < requested };
    });
  } catch (err) {
    console.error('awardPetMilestone failed:', err);
    return { pointsAwarded: 0, requested: 0, capped: false, error: true };
  }
}

module.exports = { awardPetMilestone, levelUpBonus, EVOLVE_BONUS };
