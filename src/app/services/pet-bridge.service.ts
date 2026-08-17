import { Injectable } from '@angular/core';
import { PetService } from './pet.service';
import { TransactionResult, TxnCategory } from '../models/pet.model';


export interface PendingCelebration {
  result: TransactionResult;
  merchant?: string;
}

// Bridges REAL NETS payments (QR pay, P2P transfers) into the pet.
@Injectable({ providedIn: 'root' })
export class PetBridgeService {
  private pending: PendingCelebration | null = null;

  constructor(private pet: PetService) {}

  get petName(): string {
    return this.pet.state.name;
  }

  record(
    amount: number,
    rawCategory: string,
    merchant: string,
    spendPoints?: number,
  ): TransactionResult {
    const category = mapCategory(rawCategory);
    const result = this.pet.applyTransaction(amount, category, merchant);
    if (spendPoints != null && spendPoints > 0) {
      result.spendPointsEarned = spendPoints;
    }
    this.pending = mergePending(this.pending, { result, merchant });
    return result;
  }

  queueResult(result: TransactionResult): void {
    this.pending = mergePending(this.pending, { result });
  }

  // Home reads this on entry and plays the celebration chain, then it clears.
  consumePending(): PendingCelebration | null {
    const p = this.pending;
    this.pending = null;
    return p;
  }
}

function mapCategory(raw: string): TxnCategory {
  const c = (raw || '').toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => c.includes(k));

  if (has('food', 'dining', 'restaurant', 'hawker', 'lunch', 'dinner', 'breakfast', 'grocer', 'fast food', 'fnb', 'f&b')) {
    return 'food';
  }
  if (has('transport', 'transit', 'taxi', 'grab', 'mrt', 'bus', 'fuel', 'petrol', 'parking')) {
    return 'transport';
  }
  if (has('shop', 'retail', 'fashion', 'apparel', 'electronic', 'department', 'grocery')) {
    return 'shopping';
  }
  return 'other';
}

function mergePending(prev: PendingCelebration | null, next: PendingCelebration): PendingCelebration {
  if (!prev) {
    return next;
  }

  const merged: PendingCelebration = { ...next };
  const r = merged.result;
  const p = prev.result;

  if (p.leveledUp && !r.leveledUp) {
    r.leveledUp = true;
    r.newLevel = p.newLevel;
  }
  if (p.evolved && !r.evolved) {
    r.evolved = true;
    r.newStage = p.newStage;
  }
  if (p.revived) {
    r.revived = true;
  }
  return merged;
}
