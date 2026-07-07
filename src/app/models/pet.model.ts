import { TapatchiMood } from '../components/tapatchi/tapatchi.component';

export type PetStage = 'Baby' | 'Teen' | 'Adult';

/** Transaction categories that affect the pet differently (see overview.md). */
export type TxnCategory = 'food' | 'shopping' | 'transport' | 'other';

/** The single source of truth for the user's Tapatchi. */
export interface PetState {
  name: string;
  level: number;
  stage: PetStage;
  /** Current XP earned toward the next level. */
  xp: number;
  /** XP required to reach the next level (level × 100). */
  xpMax: number;
  /** 0–100. Drives the XP multiplier and the pet's mood. */
  happiness: number;
  /** 0–100. Restored only by food transactions. */
  hunger: number;
}

export { TapatchiMood };
