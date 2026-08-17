import { TapatchiMood } from '../components/tapatchi/tapatchi.component';

export type PetStage = 'Baby' | 'Teen' | 'Adult';

// Spending categories - each one affects the pet differently (food fills hunger etc)
export type TxnCategory = 'food' | 'shopping' | 'transport' | 'other';

// Everything about the pet lives in this one object
export interface PetState {
  name: string;
  level: number;
  stage: PetStage;
  xp: number;
  xpMax: number;
  happiness: number;
  hunger: number;
  selectedEgg: string;
  lastFedAt: number | null;
  faintedAt: number | null;
  hungerZeroSince: number | null;
  lastDecayAt: number;
  dailyXpEarned: number;
  dailyXpDate: string;
  onboarded: boolean;
  createdAt: number | null;
  totalTransactions: number;
  totalXpEarned: number;
  merchantCounts: Record<string, number>;
  currentStreak: number;
  longestStreak: number;
  lastTransactionDate: string;
  tutorialCompleted: boolean;
}

export interface TransactionResult {
  xpGained: number;
  xpCapped: boolean;
  hungerRestored: number;
  happinessGained: number;
  pointsEarned: number;
  spendPointsEarned?: number;
  leveledUp: boolean;
  newLevel?: number;
  evolved: boolean;
  newStage?: PetStage;
  revived: boolean;
}

export interface MilestoneConfirmation {
  pointsAwarded: number;
  requested: number;
  capped: boolean;
}

export interface PendingPetReward {
  id: string;
  xp: number;
  happiness: number;
  sourceType: string;
  sourceLabel: string;
  queuedAt: string;
}

export { TapatchiMood };
