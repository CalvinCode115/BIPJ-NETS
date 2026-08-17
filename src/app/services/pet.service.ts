import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { AuthService } from './auth.service';
import {
  PetState,
  PetStage,
  TxnCategory,
  TapatchiMood,
  TransactionResult,
  PendingPetReward,
  MilestoneConfirmation,
} from '../models/pet.model';


const STORAGE_KEY = 'payogotchi_pet';
const FALLBACK_OWNER = 'user_1';

// how much XP the pet can earn per day, depends on its stage
const DAILY_XP_CAP: Record<PetStage, number> = {
  Baby: 200,
  Teen: 400,
  Adult: 600,
};

// max XP from one single transaction
const PER_TXN_XP_CAP = 250;

// anything below 50 cents earns nothing
const MIN_TXN_AMOUNT = 0.5;

const ONE_DAY_MS = 86_400_000;

// how much hunger drains per day with no food. Bigger pets get hungrier
const DAILY_HUNGER_DECAY: Record<PetStage, number> = {
  Baby: 10,
  Teen: 15,
  Adult: 20,
};

// happiness drains at the same rate whatever the stage
const DAILY_HAPPINESS_DECAY = 5;

// hunger has to sit at 0 for this many straight days before the pet faints
const FAINT_AFTER_DAYS = 3;

// hunger a revived pet wakes up with, so it isn't instantly starving again
const REVIVE_HUNGER_FLOOR = 50;

// NETS Points bonus for reaching a given pet level. 
function levelUpBonus(level: number): number {
  if (level <= 10) return 3;
  if (level <= 20) return 5;
  if (level <= 25) return 6;
  if (level <= 30) return 8;
  if (level <= 35) return 12;
  if (level <= 40) return 15;
  if (level <= 49) return 20;
  return 40; // level 50+
}

// NETS Points bonus for a stage evolution (Baby -> Teen -> Adult).
const EVOLVE_MILESTONE_BONUS = 50;

// how long to wait between attempts at reading the pet, while the API is
const COLD_START_RETRY_MS = 2_000;

export type PetSyncStatus = 'loaded' | 'empty' | 'unavailable';

// A fresh install starts with a brand new level 1 pet, which sends
// the user through the intro -> egg -> hatch flow
@Injectable({ providedIn: 'root' })
export class PetService {
  readonly state: PetState = PetService.freshState();

  // ---- Milestone bonus  ----
  private readonly milestoneConfirmed = new Subject<MilestoneConfirmation>();
  readonly milestoneBonusConfirmed = this.milestoneConfirmed.asObservable();
  private pendingConfirmation: MilestoneConfirmation | null = null;


  private loadedOwner: string | null = null;

  private cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;

  private cloudReadOk = false;

  constructor(private http: HttpClient, private auth: AuthService) {
    this.loadLocalFor(this.ownerId);
    this.migrateLegacyFields();
    this.applyDecay();
  }

  get ownerId(): string {
    return this.auth.userId ?? FALLBACK_OWNER;
  }

  // default state for a brand new user
  private static freshState(): PetState {
    return {
      name: 'Tapatchi',
      level: 1,
      stage: 'Baby',
      xp: 0,
      xpMax: 100,
      happiness: 70,
      hunger: 70,
      selectedEgg: '',
      lastFedAt: null,
      faintedAt: null,
      hungerZeroSince: null,
      lastDecayAt: Date.now(),
      dailyXpEarned: 0,
      dailyXpDate: '',
      onboarded: false,
      createdAt: null,
      totalTransactions: 0,
      totalXpEarned: 0,
      merchantCounts: {},
      currentStreak: 0,
      longestStreak: 0,
      lastTransactionDate: '',
      tutorialCompleted: false,
    };
  }

  // ---- Demo helpers ----
  resetNewUser(): void {
    Object.assign(this.state, PetService.freshState());
    this.save();
  }

  seedReturningUser(): void {
    Object.assign(this.state, {
      name: 'Tapatchi',
      level: 9,
      stage: 'Baby',
      xp: 780,
      xpMax: 900,
      happiness: 90,
      hunger: 85,
      selectedEgg: 'pink',
      lastFedAt: Date.now(),
      faintedAt: null,
      hungerZeroSince: null,
      lastDecayAt: Date.now(),
      dailyXpEarned: 200, // baby cap is 200 so no more XP today
      dailyXpDate: this.todayStr(),
      onboarded: true,
      createdAt: Date.now() - 12 * 86_400_000, // "12 days together"
      totalTransactions: 47,
      totalXpEarned: 12_450,
      merchantCounts: { Starbucks: 9, 'Hawker Lunch': 6, Uniqlo: 3 },
      currentStreak: 7,
      longestStreak: 7,
      lastTransactionDate: this.todayStr(),
      tutorialCompleted: true,
    } satisfies PetState);
    this.save();
  }

  completeOnboarding(): void {
    this.state.onboarded = true;
    if (this.state.createdAt === null) {
      this.state.createdAt = Date.now();
    }
    this.state.lastDecayAt = Date.now();
    this.save();
  }

  resetDailyXpCap(): void {
    this.state.dailyXpEarned = 0;
    this.state.dailyXpDate = this.todayStr();
    this.save();
  }

  setSelectedEgg(egg: string): void {
    this.state.selectedEgg = egg;
    this.save();
  }

  // ---- Name ----
  setName(name: string): void {
    const trimmed = name.trim();
    if (trimmed) {
      this.state.name = trimmed;
      this.save();
    }
  }

  // ---- Values the screens display ----

  // how full the XP bar should be (0 to 1)
  get xpProgress(): number {
    return this.state.xpMax > 0 ? Math.min(this.state.xp / this.state.xpMax, 1) : 0;
  }

  // true once hunger has been at 0 for FAINT_AFTER_DAYS straight. The home page uses this to swap in the fainted layout instead of the normal one.
  get isFainted(): boolean {
    return this.state.faintedAt !== null;
  }

  // whole days the pet has been starving (hunger at 0), 0 if it isn't
  get daysStarving(): number {
    if (this.state.hungerZeroSince === null) {
      return 0;
    }
    return Math.floor((Date.now() - this.state.hungerZeroSince) / ONE_DAY_MS);
  }

  // work out the pet's mood from hunger + happiness
  get mood(): TapatchiMood {
    // a fainted pet outranks every other mood 
    if (this.isFainted) {
      return 'fainted';
    }
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

  // short line for the pet's speech bubble
  get statusText(): string {
    const name = this.state.name;
    switch (this.mood) {
      case 'fainted':
        return `${name} has fainted... feed it! 💔`;
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

  // ---- Journey stats (pet-settings page) ----

  // whole days since onboarding finished, counting today as day 1
  get daysTogether(): number {
    if (this.state.createdAt === null) {
      return 0;
    }
    return Math.max(1, Math.floor((Date.now() - this.state.createdAt) / 86_400_000) + 1);
  }

  get favouriteMerchant(): string | null {
    const entries = Object.entries(this.state.merchantCounts);
    if (entries.length === 0) {
      return null;
    }
    return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  }

  // ---- Actions ----

  // feed the pet (snacks button / food transactions)
  feed(amount = 10): void {
    this.state.hunger = this.clamp(this.state.hunger + amount);
    this.state.happiness = this.clamp(this.state.happiness + 5);
    this.state.lastFedAt = Date.now();
    this.revive();
    this.save();
  }

  // playing with the pet makes it happier
  play(amount = 15): void {
    this.state.happiness = this.clamp(this.state.happiness + amount);
    this.save();
  }

  // ---- Time-based decay (the care loop) ----

  // Applies however much hunger/happiness decay is owed since the last time
  applyDecay(): void {
    // an un-hatched pet has no meters to drain yet
    if (!this.state.onboarded) {
      return;
    }

    const now = Date.now();
    const elapsedDays = Math.floor((now - this.state.lastDecayAt) / ONE_DAY_MS);
    if (elapsedDays <= 0) {
      return;
    }

    const hungerBefore = this.state.hunger;
    const hungerRate = DAILY_HUNGER_DECAY[this.state.stage];

    this.state.hunger = this.clamp(hungerBefore - hungerRate * elapsedDays);
    this.state.happiness = this.clamp(
      this.state.happiness - DAILY_HAPPINESS_DECAY * elapsedDays
    );

    if (this.state.hunger === 0 && hungerBefore > 0) {
      const daysToZero = Math.ceil(hungerBefore / hungerRate);
      this.state.hungerZeroSince = this.state.lastDecayAt + daysToZero * ONE_DAY_MS;
    }

    this.state.lastDecayAt += elapsedDays * ONE_DAY_MS;
    this.refreshFaint(now);
    this.save();
  }

  private refreshFaint(now: number): void {
    if (this.state.hunger > 0) {
      this.state.hungerZeroSince = null;
      return;
    }

    if (this.state.hungerZeroSince === null) {
      this.state.hungerZeroSince = now;
    }

    const starvedFor = now - this.state.hungerZeroSince;
    if (this.state.faintedAt === null && starvedFor >= FAINT_AFTER_DAYS * ONE_DAY_MS) {
      this.state.faintedAt = now;
    }
  }

  // Wakes a fainted pet back up and clears the starvation clock
  private revive(): boolean {
    this.state.hungerZeroSince = null;
    if (this.state.faintedAt === null) {
      return false;
    }
    this.state.faintedAt = null;
    this.state.hunger = Math.max(this.state.hunger, REVIVE_HUNGER_FLOOR);
    return true;
  }

  simulateDaysPassing(days = 1): void {
    const shift = days * ONE_DAY_MS;
    this.state.lastDecayAt -= shift;
    if (this.state.lastFedAt !== null) {
      this.state.lastFedAt -= shift;
    }
    if (this.state.hungerZeroSince !== null) {
      this.state.hungerZeroSince -= shift;
    }
    this.applyDecay();
  }

  // The main game logic: apply a NETS transaction to the pet.
  applyTransaction(amount: number, category: TxnCategory, merchant?: string): TransactionResult {
    const result: TransactionResult = {
      xpGained: 0,
      xpCapped: false,
      hungerRestored: 0,
      happinessGained: 0,
      pointsEarned: 0,
      leveledUp: false,
      evolved: false,
      revived: false,
    };

    this.applyDecay();

    // 1. too small to count, nothing happens
    if (amount < MIN_TXN_AMOUNT) {
      this.save();
      return result;
    }

    // 2. base XP = amount x 10, but capped per transaction
    const baseXp = Math.min(amount * 10, PER_TXN_XP_CAP);

    // 3. happier pet = more XP
    let xp = Math.round(baseXp * this.happinessMultiplier);

    // 4. check the daily cap (counter resets when the date changes)
    const today = this.todayStr();
    if (this.state.dailyXpDate !== today) {
      this.state.dailyXpEarned = 0;
      this.state.dailyXpDate = today;
    }
    const remaining = Math.max(0, DAILY_XP_CAP[this.state.stage] - this.state.dailyXpEarned);
    if (xp > remaining) {
      xp = remaining;
      result.xpCapped = true;
    }
    this.state.dailyXpEarned += xp;

    // 5. food fills hunger back up, and wakes up a fainted pet
    if (category === 'food') {
      const hungerBefore = this.state.hunger;
      this.state.hunger = this.clamp(this.state.hunger + Math.min(amount * 2, 40));
      result.revived = this.revive();
      result.hungerRestored = this.state.hunger - hungerBefore;
      this.state.lastFedAt = Date.now();
    }

    // spending anything gives a small happiness bump
    const happinessBefore = this.state.happiness;
    this.state.happiness = this.clamp(this.state.happiness + 3);
    result.happinessGained = this.state.happiness - happinessBefore;

    // 6. add the XP and check if we levelled up / evolved
    const levelBefore = this.state.level;
    const stageBefore = this.state.stage;
    this.addXp(xp);
    result.xpGained = xp;
    if (this.state.level > levelBefore) {
      result.leveledUp = true;
      result.newLevel = this.state.level;
    }
    if (this.state.stage !== stageBefore) {
      result.evolved = true;
      result.newStage = this.state.stage;
    }

    // 7. NETS Points are only awarded for a level-up/evolution milestone 
    result.pointsEarned = this.awardMilestoneBonus(levelBefore, this.state.level, result.evolved, result.newStage);

    // 8. lifetime stats for the pet-settings "Journey" card
    this.state.totalTransactions += 1;
    this.recordMerchant(merchant);
    this.updateStreak(today);

    // 9. save and done
    this.save();
    return result;
  }

  // Computes the NETS Points bonus for a level-up/evolution 
  private awardMilestoneBonus(fromLevel: number, toLevel: number, evolved: boolean, newStage?: PetStage): number {
    let bonus = 0;
    for (let level = fromLevel + 1; level <= toLevel; level++) {
      bonus += levelUpBonus(level);
    }
    if (evolved) {
      bonus += EVOLVE_MILESTONE_BONUS;
    }
    if (bonus > 0) {
      this.pendingConfirmation = null;

      this.http
        .post<Partial<MilestoneConfirmation>>(
          `${API_BASE_URL}/users/${this.ownerId}/payogotchi/milestone-bonus`,
          { fromLevel, toLevel, evolved, newStage }
        )
        .subscribe({
          next: (res) => {
            const confirmation: MilestoneConfirmation = {
              pointsAwarded: res?.pointsAwarded ?? bonus,
              requested: res?.requested ?? bonus,
              capped: res?.capped === true,
            };
            this.pendingConfirmation = confirmation;
            this.milestoneConfirmed.next(confirmation);
          },
          error: () => { },
        });
    }
    return bonus;
  }

  consumeMilestoneConfirmation(): MilestoneConfirmation | null {
    const confirmation = this.pendingConfirmation;
    this.pendingConfirmation = null;
    return confirmation;
  }

  private recordMerchant(merchant?: string): void {
    const name = merchant?.trim();
    if (!name) {
      return;
    }
    this.state.merchantCounts[name] = (this.state.merchantCounts[name] ?? 0) + 1;
  }

  private updateStreak(today: string): void {
    const last = this.state.lastTransactionDate;
    const gap = last ? this.daysBetween(last, today) : null;

    if (gap === 0) {
      return; 
    }
    this.state.currentStreak = gap === 1 ? this.state.currentStreak + 1 : 1;
    this.state.lastTransactionDate = today;
    this.state.longestStreak = Math.max(this.state.longestStreak, this.state.currentStreak);
  }

  private daysBetween(a: string, b: string): number {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    const msPerDay = 86_400_000;
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / msPerDay);
  }

  // add XP, and keep levelling up while there's enough for the next level
  addXp(amount: number): void {
    this.state.xp += amount;
    this.state.totalXpEarned += amount;
    while (this.state.xp >= this.state.xpMax) {
      this.state.xp -= this.state.xpMax;
      this.state.level += 1;
      this.state.xpMax = this.state.level * 100;
      this.refreshStage();
    }
  }

  // Grants the one-time tutorial completion bonus and reports whether it levelled up / evolved the pet
  awardTutorialCompletion(amount: number): TransactionResult | null {
    if (this.state.tutorialCompleted) {
      return null;
    }
    this.state.tutorialCompleted = true;

    const levelBefore = this.state.level;
    const stageBefore = this.state.stage;
    this.addXp(amount);

    const evolved = this.state.stage !== stageBefore;
    const newStage = evolved ? this.state.stage : undefined;

    const result: TransactionResult = {
      xpGained: amount,
      xpCapped: false,
      hungerRestored: 0,
      happinessGained: 0,
      pointsEarned: this.awardMilestoneBonus(levelBefore, this.state.level, evolved, newStage),
      leveledUp: this.state.level > levelBefore,
      newLevel: this.state.level > levelBefore ? this.state.level : undefined,
      evolved,
      newStage,
      revived: false,
    };
    this.save();
    return result;
  }

  // ---- Rewards -> pet (Yunen's quest/challenge XP) ----
  awardPetProgress(grant: { xp?: number; happiness?: number }): TransactionResult {
    const xp = Math.max(0, Math.round(grant.xp ?? 0));
    const happiness = Math.max(0, Math.round(grant.happiness ?? 0));

    const levelBefore = this.state.level;
    const stageBefore = this.state.stage;

    const happinessBefore = this.state.happiness;
    if (happiness > 0) {
      this.state.happiness = this.clamp(this.state.happiness + happiness);
    }
    if (xp > 0) {
      this.addXp(xp);
    }

    const evolved = this.state.stage !== stageBefore;
    const newStage = evolved ? this.state.stage : undefined;
    const leveledUp = this.state.level > levelBefore;

    const result: TransactionResult = {
      xpGained: xp,
      xpCapped: false,
      hungerRestored: 0,
      happinessGained: this.state.happiness - happinessBefore,
      pointsEarned: this.awardMilestoneBonus(levelBefore, this.state.level, evolved, newStage),
      leveledUp,
      newLevel: leveledUp ? this.state.level : undefined,
      evolved,
      newStage,
      revived: false,
    };

    this.save();
    return result;
  }

  // Pulls everything the pet is owed from claimed quests/challenges
  async drainPendingRewards(): Promise<TransactionResult[]> {
    const owner = this.ownerId;

    try {
      const res = await firstValueFrom(
        this.http.get<{ pending: PendingPetReward[] }>(
          `${API_BASE_URL}/users/${owner}/payogotchi/pending-rewards`
        )
      );

      const pending = res?.pending ?? [];
      if (pending.length === 0) {
        return [];
      }

      const results = pending.map((grant) =>
        this.awardPetProgress({ xp: grant.xp, happiness: grant.happiness })
      );

      await firstValueFrom(
        this.http.post(`${API_BASE_URL}/users/${owner}/payogotchi/pending-rewards/ack`, {
          ids: pending.map((grant) => grant.id),
        })
      );

      return results;
    } catch {
      return [];
    }
  }

  // happier pet earns more XP, sad pet earns less
  private get happinessMultiplier(): number {
    const h = this.state.happiness;
    if (h >= 80) return 1.2;
    if (h >= 50) return 1.0;
    if (h >= 20) return 0.8;
    return 0.5;
  }

  // stage depends on level: 1-15 baby, 16-35 teen, 36+ adult
  private refreshStage(): void {
    const lvl = this.state.level;
    this.state.stage = lvl >= 36 ? 'Adult' : lvl >= 16 ? 'Teen' : 'Baby';
  }

  // Keep a meter between 0 and 100, as a whole number.
  private clamp(value: number): number {
    return Math.round(Math.max(0, Math.min(100, value)));
  }

  // today's date as 'YYYY-MM-DD', used for the daily XP counter
  private todayStr(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  // ---- Saving/loading ----
  private cacheKey(owner: string): string {
    return `${STORAGE_KEY}_${owner}`;
  }

  private loadLocalFor(owner: string): void {
    Object.assign(this.state, PetService.freshState());
    try {
      const raw =
        localStorage.getItem(this.cacheKey(owner)) ??
        (owner === FALLBACK_OWNER ? localStorage.getItem(STORAGE_KEY) : null);
      if (raw) {
        Object.assign(this.state, JSON.parse(raw) as Partial<PetState>);
      }
    } catch {
    }
    this.loadedOwner = owner;
    this.cloudReadOk = false;
  }

  private migrateLegacyFields(): void {
    let changed = false;
    for (const meter of ['hunger', 'happiness'] as const) {
      const value = this.state[meter];
      if (!Number.isInteger(value)) {
        this.state[meter] = this.clamp(value);
        changed = true;
      }
    }

    if (this.state.onboarded && this.state.createdAt === null) {
      this.state.createdAt = Date.now();
      changed = true;
    }

    // approximate lifetime XP from level + current xp: every completed
    // level L cost L*100 XP, plus whatever's earned towards the next one
    if (this.state.totalXpEarned === 0 && (this.state.level > 1 || this.state.xp > 0)) {
      const level = this.state.level;
      this.state.totalXpEarned = Math.round((100 * (level - 1) * level) / 2 + this.state.xp);
      changed = true;
    }

    if (changed) {
      this.writeLocal();
    }
  }

  // MUST NOT confuse with "no pet".
  private async fetchCloudPet(owner: string, attempts = 3): Promise<Partial<PetState> | null> {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await firstValueFrom(
          this.http.get<{ pet: Partial<PetState> | null }>(
            `${API_BASE_URL}/users/${owner}/payogotchi`
          )
        );
        return res?.pet ?? null;
      } catch (err) {
        lastError = err;
        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, COLD_START_RETRY_MS));
        }
      }
    }

    throw lastError;
  }

  // Reconcile the in-memory pet with Firestore. 
  async syncFromCloud(): Promise<PetSyncStatus> {
    const owner = this.ownerId;
    // account switched since last load - swap to that user's cached pet first
    if (this.loadedOwner !== owner) {
      this.loadLocalFor(owner);
    }

    try {
      const pet = await this.fetchCloudPet(owner);
      this.cloudReadOk = true;

      if (pet) {
        Object.assign(this.state, pet);
        this.migrateLegacyFields();
        this.applyDecay();
        this.writeLocal();
        return 'loaded';
      }

      this.saveToCloud();
      return 'empty';
    } catch {
      return 'unavailable';
    }
  }

  private save(): void {
    this.writeLocal();
    this.scheduleCloudSave();
  }

  private writeLocal(): void {
    try {
      localStorage.setItem(this.cacheKey(this.ownerId), JSON.stringify(this.state));
    } catch {
    }
  }

  private scheduleCloudSave(): void {
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
    }
    this.cloudSaveTimer = setTimeout(() => this.saveToCloud(), 500);
  }

  // Push the current pet to Firestore via the backend. Fire-and-forget:
  // a failure (offline) is fine because the local cache already holds it.
  private async saveToCloud(): Promise<void> {
    this.cloudSaveTimer = null;
    const owner = this.ownerId;

    if (!this.cloudReadOk) {
      try {
        const remote = await this.fetchCloudPet(owner, 1);
        this.cloudReadOk = true;
        if (remote?.onboarded && !this.state.onboarded) {
          Object.assign(this.state, remote);
          this.migrateLegacyFields();
          this.applyDecay();
          this.writeLocal();
          return; 
        }
      } catch {
        return;
      }
    }

    this.http
      .put(`${API_BASE_URL}/users/${owner}/payogotchi`, { pet: this.state })
      .subscribe({ next: () => { }, error: () => { } });
  }
}
