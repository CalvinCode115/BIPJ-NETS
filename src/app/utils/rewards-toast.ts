// Builds the "what you just earned" line shown after a successful payment.
//
// Two separate reward systems fire on one payment, so the message pulls from
// both: the pet's XP (Payogotchi, client-side) and the account's NETS Points
// (the rewards backend). Either can legitimately be absent — P2P transfers
// feed the pet but earn no points, and a failed rewards write returns 0 —
// so each part is only included when it actually happened.

export interface RewardsToastInput {
  /** XP the pet gained from this payment. */
  xpGained?: number;
  /** True if the daily XP cap trimmed the award. */
  xpCapped?: boolean;
  /** NETS Points credited by the rewards backend. */
  pointsAwarded?: number;
  leveledUp?: boolean;
  newLevel?: number;
  evolved?: boolean;
  newStage?: string;
  /** True if this payment woke a fainted pet. */
  revived?: boolean;
  /** Pet's display name, if known. */
  petName?: string;
}

/**
 * Returns the toast message, or null when there is nothing worth announcing
 * (no XP and no points) — callers should skip the toast entirely in that case
 * rather than showing an empty one.
 */
export function buildRewardsToastMessage(input: RewardsToastInput): string | null {
  const xp = Math.max(0, Math.round(input.xpGained ?? 0));
  const points = Math.max(0, Math.round(input.pointsAwarded ?? 0));

  if (xp <= 0 && points <= 0) {
    return null;
  }

  const name = (input.petName || '').trim() || 'Tapatchi';

  const earned: string[] = [];
  if (xp > 0) {
    earned.push(`${name} +${xp} XP${input.xpCapped ? ' (daily cap)' : ''}`);
  }
  if (points > 0) {
    earned.push(`+${points.toLocaleString()} NETS Points`);
  }

  // Milestones go after the numbers so the earned amounts always read first.
  const milestones: string[] = [];
  if (input.revived) {
    milestones.push(`${name} woke up!`);
  }
  if (input.leveledUp) {
    milestones.push(input.newLevel ? `Level ${input.newLevel}!` : 'Level up!');
  }
  if (input.evolved) {
    milestones.push(input.newStage ? `Evolved to ${input.newStage}!` : 'Evolved!');
  }

  const head = earned.join('  ·  ');
  return milestones.length ? `${head} — ${milestones.join(' ')}` : head;
}
