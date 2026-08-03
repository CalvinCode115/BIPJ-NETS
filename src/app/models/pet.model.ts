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

  // NETS Points balance (earn 10% of base XP per transaction)
  netsPoints: number;
  // which egg the user picked at the start, e.g. 'pink'
  selectedEgg: string;
  // when the pet was last fed (timestamp), null if never
  lastFedAt: number | null;
  // when the pet fainted (timestamp), null if it's fine
  faintedAt: number | null;
  // last time we applied the daily hunger/happiness decay
  lastDecayAt: number;
  // XP earned today (there's a daily cap)
  dailyXpEarned: number;
  // which day the counter above is for, format 'YYYY-MM-DD'
  dailyXpDate: string;
  // true once the user finished picking an egg + hatching + naming
  onboarded: boolean;
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
  pointsEarned: number;
  leveledUp: boolean;
  newLevel?: number;
  evolved: boolean;
  newStage?: PetStage;
  // true if the pet was fainted and this transaction woke it up
  revived: boolean;
}

export { TapatchiMood };
