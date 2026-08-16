import { TapatchiMood } from '../components/tapatchi/tapatchi.component';

export type PetStage = 'Baby' | 'Teen' | 'Adult';

// Spending categories - each one affects the pet differently (food fills hunger etc)
export type TxnCategory = 'food' | 'shopping' | 'transport' | 'other';

// Everything about the pet lives in this one object
export interface PetState {
  name: string;
  level: number;
  stage: PetStage;
  // XP collected so far for the current level
  xp: number;
  // XP needed to hit the next level (level x 100)
  xpMax: number;
  // 0-100, affects the XP multiplier and how the pet looks/feels
  happiness: number;
  // 0-100, only food transactions fill this back up
  hunger: number;

  // which egg the user picked at the start, e.g. 'pink'
  selectedEgg: string;
  // when the pet was last fed (timestamp), null if never
  lastFedAt: number | null;
  // when the pet fainted (timestamp), null if it's fine
  faintedAt: number | null;
  // when hunger first hit 0 (timestamp), null whenever hunger > 0. The pet
  // faints once hunger has been at 0 for FAINT_AFTER_DAYS straight — this
  // is what makes that "consecutive days" check possible across app restarts.
  hungerZeroSince: number | null;
  // last time we applied the daily hunger/happiness decay
  lastDecayAt: number;
  // XP earned today (there's a daily cap)
  dailyXpEarned: number;
  // which day the counter above is for, format 'YYYY-MM-DD'
  dailyXpDate: string;
  // true once the user finished picking an egg + hatching + naming
  onboarded: boolean;

  // ---- Lifetime stats, shown on the pet-settings "Journey" card ----
  // when onboarding finished (the pet's "birthday"), null until then
  createdAt: number | null;
  // count of every transaction that earned XP, never resets
  totalTransactions: number;
  // cumulative XP across every level, never resets (unlike xp above)
  totalXpEarned: number;
  // transaction count per merchant name, used to work out the favourite
  merchantCounts: Record<string, number>;
  // consecutive days (including today) with at least one transaction
  currentStreak: number;
  // best currentStreak has ever been
  longestStreak: number;
  // last date (YYYY-MM-DD) a transaction was counted towards the streak
  lastTransactionDate: string;
  // true once the one-time tutorial completion XP has been claimed —
  // the tutorial can still be re-read after this, just without the reward
  tutorialCompleted: boolean;
}

// What applyTransaction() gives back after a payment.
// The home page uses this to decide which popups to show
// (feedback first, then level up, then evolution if any).
export interface TransactionResult {
  xpGained: number;
  // true if we hit the daily XP cap and had to cut the XP
  xpCapped: boolean;
  hungerRestored: number;
  happinessGained: number;
  // Real NETS Points credited for a level-up/evolution milestone triggered
  // by this event — 0 for a plain transaction with no milestone. Plain
  // spending already earns its own real points on the Rewards side (see
  // backend/services/transaction-rewards.js), so Payogotchi doesn't award
  // separate points for every transaction, only for these rarer milestones.
  pointsEarned: number;
  // Real NETS Points the SPEND itself earned (1pt/$1), credited server-side by
  // backend/services/transaction-rewards.js — a completely separate award from
  // `pointsEarned` above. The pet doesn't calculate or grant this; the payment
  // service already has the post-cap figure in its response and passes it to
  // PetBridgeService.record() purely so the pet's own feedback popup can report
  // the whole payment rather than just the milestone half.
  //
  // Absent when there was no spend to speak of — a P2P transfer (XP only, by
  // product rule), the tutorial bonus, or a quest/challenge XP grant.
  spendPointsEarned?: number;
  leveledUp: boolean;
  newLevel?: number;
  evolved: boolean;
  newStage?: PetStage;
  // true if the pet was fainted and this transaction woke it up
  revived: boolean;
}

// What the backend ACTUALLY credited for a milestone bonus, once it has
// applied the shared daily points cap and the 5000 max-balance ceiling.
//
// The pet shows its own optimistic figure the instant a level-up happens
// (no network wait), but only the backend knows how much of today's 300-point
// budget is left — so that figure is an estimate until this comes back.
// `requested` is what the pet promised; `pointsAwarded` is what landed.
export interface MilestoneConfirmation {
  pointsAwarded: number;
  requested: number;
  capped: boolean;
}

// A pet reward earned on the backend (a claimed quest or challenge) that the
// pet hasn't applied yet. Queued server-side because PetService — not the
// backend — owns levelling and evolution; see backend/services/
// payogotchi-progress.js for the full reasoning.
export interface PendingPetReward {
  id: string;
  xp: number;
  happiness: number;
  // 'daily' | 'weekly' | 'challenge' — which reward source it came from
  sourceType: string;
  // the quest/challenge name, so the celebration can say where it came from
  sourceLabel: string;
  queuedAt: string;
}

export { TapatchiMood };
