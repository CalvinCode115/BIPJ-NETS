import { Injectable } from '@angular/core';
import { PetState, PetStage, TxnCategory, TapatchiMood } from '../models/pet.model';

/**
 * Central store for the user's Tapatchi. Every Payogotchi screen reads and
 * mutates the pet through this service so state stays consistent app-wide.
 *
 * NOTE: initialised with the Figma "showcase" values (Level 8 Baby, 470/800 XP,
 * happiness 85, hunger 80) so Home looks populated for the demo. Swap the
 * defaults in `state` for a fresh Level 1 pet once the real onboarding lands.
 */
@Injectable({ providedIn: 'root' })
export class PetService {
  readonly state: PetState = {
    name: 'Tapatchi',
    level: 8,
    stage: 'Baby',
    xp: 470,
    xpMax: 800,
    happiness: 85,
    hunger: 80,
  };

  // ---- Name ----
  setName(name: string): void {
    const trimmed = name.trim();
    if (trimmed) {
      this.state.name = trimmed;
    }
  }

  // ---- Derived display helpers ----

  /** Fraction (0–1) of the XP bar that is filled. */
  get xpProgress(): number {
    return this.state.xpMax > 0 ? Math.min(this.state.xp / this.state.xpMax, 1) : 0;
  }

  /** Mood shown by the TapatchiComponent, derived from hunger + happiness. */
  get mood(): TapatchiMood {
    if (this.state.hunger <= 15) {
      return 'starving';
    }
    if (this.state.happiness >= 80) {
      return 'happy';
    }
    if (this.state.happiness >= 50) {
      return 'normal';
    }
    return 'sad';
  }

  /** Short status line for the pet's speech bubble. */
  get statusText(): string {
    const name = this.state.name;
    switch (this.mood) {
      case 'starving':
        return `${name} is hungry! 🍔`;
      case 'happy':
        return `${name} is happy! 😊`;
      case 'normal':
        return `${name} is doing okay 🙂`;
      default:
        return `${name} feels a bit sad 🥺`;
    }
  }

  // ---- Mutations (demo interactions) ----

  /** Feed the pet (Snacks button / food transactions restore hunger). */
  feed(amount = 20): void {
    this.state.hunger = this.clamp(this.state.hunger + amount);
    this.state.happiness = this.clamp(this.state.happiness + 5);
  }

  /** Play with the pet to boost happiness. */
  play(amount = 15): void {
    this.state.happiness = this.clamp(this.state.happiness + amount);
  }

  /** Simulate a NETS transaction: base XP + category-specific stat changes. */
  applyTransaction(amount: number, category: TxnCategory): void {
    this.addXp(Math.round(amount * 10 * this.happinessMultiplier));
    if (category === 'food') {
      this.state.hunger = this.clamp(this.state.hunger + Math.min(amount * 2, 40));
    }
    this.state.happiness = this.clamp(this.state.happiness + 3);
  }

  /** Add XP, rolling over into new levels as thresholds are crossed. */
  addXp(amount: number): void {
    this.state.xp += amount;
    while (this.state.xp >= this.state.xpMax) {
      this.state.xp -= this.state.xpMax;
      this.state.level += 1;
      this.state.xpMax = this.state.level * 100;
      this.refreshStage();
    }
  }

  /** XP multiplier driven by happiness (see overview.md). */
  private get happinessMultiplier(): number {
    const h = this.state.happiness;
    if (h >= 80) return 1.2;
    if (h >= 50) return 1.0;
    if (h >= 20) return 0.8;
    return 0.5;
  }

  private refreshStage(): void {
    const lvl = this.state.level;
    this.state.stage = lvl >= 36 ? 'Adult' : lvl >= 16 ? 'Teen' : 'Baby';
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }
}
