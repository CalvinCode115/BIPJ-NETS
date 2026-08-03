import { Injectable } from '@angular/core';
import { PetService } from './pet.service';
import { TransactionResult, TxnCategory } from '../models/pet.model';

// A celebration waiting to be shown on the Payogotchi Home screen.
// Real payments happen on the Pay tab, so the pet reacts immediately
// (state + Firestore) but the feedback/level-up popups are queued here
// and played the next time the user opens the Payogotchi tab.
export interface PendingCelebration {
  result: TransactionResult;
  merchant: string;
}

// Bridges REAL NETS payments (QR pay, P2P transfers) into the pet.
// The payment services call record() after a successful payment; this
// maps the payment into the pet's game logic (applyTransaction, which
// also persists to Firestore) and queues the celebration for Home.
//
// This is the single seam between the payment feature (JunJie) and
// Payogotchi (Calvin): payment services depend only on record(), and
// none of the pay UI needs to know the pet exists.
@Injectable({ providedIn: 'root' })
export class PetBridgeService {
  private pending: PendingCelebration | null = null;

  constructor(private pet: PetService) {}

  // Apply a real payment to the pet. `rawCategory` is the backend's
  // free-text category (e.g. 'Coffee', 'Retail'); we map it to the
  // pet's category so food payments restore hunger, etc.
  record(amount: number, rawCategory: string, merchant: string): TransactionResult {
    const category = mapCategory(rawCategory);
    const result = this.pet.applyTransaction(amount, category, merchant);
    this.pending = mergePending(this.pending, { result, merchant });
    return result;
  }

  // Home reads this on entry and plays the celebration chain, then it clears.
  consumePending(): PendingCelebration | null {
    const p = this.pending;
    this.pending = null;
    return p;
  }
}

// Map the backend's free-text category to the pet's TxnCategory.
// Only real meals restore hunger; drinks/coffee count as generic spend
// (matching the Home demo, where Coffee is 'other' and Lunch is 'food').
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

// Keep the newest celebration, but don't lose a level-up / evolution /
// revival flag from an earlier queued payment (those drive the big popups).
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
