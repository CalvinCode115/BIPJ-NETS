import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { AuthService } from './auth.service';
import {
  PetState,
  PetStage,
  TxnCategory,
  TapatchiMood,
  TransactionResult,
} from '../models/pet.model';

// base key we save the pet under in localStorage. The real cache key is
// namespaced per user (payogotchi_pet_<userId>) so two accounts on the
// same device keep separate pets. The bare key is the legacy pre-multi-user
// save, still read once so the pet you already built isn't lost.
const STORAGE_KEY = 'payogotchi_pet';

// when nobody is logged in we fall back to this demo account so the pet
// still persists to Firestore during a demo without a login step.
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

// NETS Points bonus for reaching a given pet level. Mirrors
// backend/services/payogotchi-rewards.js's levelUpBonus() exactly — keep
// both in sync if either changes. Deliberately much smaller than the real
// 10-points-per-dollar transaction rate (see transaction-rewards.js on the
// backend): these are meant to be hard to earn, a rare milestone reward,
// not a second way to farm the points economy. Level 50 is the current
// final level, so it (and anything past it) gets the top bonus.
function levelUpBonus(level: number): number {
  if (level <= 10) return 5;
  if (level <= 20) return 10;
  if (level <= 25) return 15;
  if (level <= 30) return 20;
  if (level <= 35) return 30;
  if (level <= 40) return 40;
  if (level <= 49) return 50;
  return 100; // level 50+
}

// NETS Points bonus for a stage evolution (Baby -> Teen -> Adult).
const EVOLVE_MILESTONE_BONUS = 100;

// This service holds the pet's state and all the game logic.
// Every Payogotchi screen reads/updates the pet through here so
// they all stay in sync.
//
// The pet is saved to localStorage after every change and loaded
// back when the app starts, so refreshing the browser doesn't
// wipe it. (Firestore is planned but not done yet.)
//
// A fresh install starts with a brand new level 1 pet, which sends
// the user through the intro -> egg -> hatch flow. For demos we can
// also load a "returning user" pet using seedReturningUser().
@Injectable({ providedIn: 'root' })
export class PetService {
  readonly state: PetState = PetService.freshState();

  // which user the in-memory state currently belongs to, so we can detect
  // an account switch and reload the right pet instead of bleeding across users
  private loadedOwner: string | null = null;
  // debounce handle so a burst of save() calls = one Firestore write
  private cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private http: HttpClient, private auth: AuthService) {
    // instant state from the local cache for the current owner; the entry
    // guard calls syncFromCloud() to reconcile with Firestore before routing
    this.loadLocalFor(this.ownerId);
    this.migrateLegacyFields();
  }

  // the account the pet belongs to: the logged-in user, or the demo
  // fallback. Public so other Payogotchi screens can look up the same
  // user's real NETS Points balance via PointsService without duplicating
  // this fallback logic.
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

  // wipe everything back to a new user (intro flow will run again)
  resetNewUser(): void {
    Object.assign(this.state, PetService.freshState());
    this.save();
  }

  // Load a demo "returning user": level 9 baby thats very close to
  // level 10 (780/900 XP) but already maxed out today's XP cap.
  // Demo flow: tap a transaction -> blocked by cap (toast shows) ->
  // reset the cap -> tap again -> level up popup!
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

  // called after the naming screen, user is done with onboarding
  completeOnboarding(): void {
    this.state.onboarded = true;
    // the pet's "birthday" for the Days Together stat — only stamp it once
    if (this.state.createdAt === null) {
      this.state.createdAt = Date.now();
    }
    this.save();
  }

  // demo button: clear today's XP cap so the pet can earn again
  // (pretends it's a new day)
  resetDailyXpCap(): void {
    this.state.dailyXpEarned = 0;
    this.state.dailyXpDate = this.todayStr();
    this.save();
  }

  // remember which egg was picked on the egg selection screen
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

  // work out the pet's mood from hunger + happiness
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

  // short line for the pet's speech bubble
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

  // ---- Journey stats (pet-settings page) ----

  // whole days since onboarding finished, counting today as day 1
  get daysTogether(): number {
    if (this.state.createdAt === null) {
      return 0;
    }
    return Math.max(1, Math.floor((Date.now() - this.state.createdAt) / 86_400_000) + 1);
  }

  // merchant with the most transactions, or null if none recorded yet
  get favouriteMerchant(): string | null {
    const entries = Object.entries(this.state.merchantCounts);
    if (entries.length === 0) {
      return null;
    }
    return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  }

  // ---- Actions ----

  // feed the pet (snacks button / food transactions)
  feed(amount = 20): void {
    this.state.hunger = this.clamp(this.state.hunger + amount);
    this.state.happiness = this.clamp(this.state.happiness + 5);
    this.state.lastFedAt = Date.now();
    if (this.state.faintedAt !== null) {
      this.state.faintedAt = null;
      this.state.hunger = Math.max(this.state.hunger, 50);
    }
    this.save();
  }

  // playing with the pet makes it happier
  play(amount = 15): void {
    this.state.happiness = this.clamp(this.state.happiness + amount);
    this.save();
  }

  // The main game logic: apply a NETS transaction to the pet.
  // Returns a result object so the home page knows which popups
  // to show after (feedback -> level up -> evolution).
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
      if (this.state.faintedAt !== null) {
        this.state.faintedAt = null;
        this.state.hunger = Math.max(this.state.hunger, 50);
        result.revived = true;
      }
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

    // 7. NETS Points are only awarded for a level-up/evolution milestone —
    // plain spending already earns real points on the Rewards side (see
    // backend/services/transaction-rewards.js), so Payogotchi doesn't award
    // its own separate points for every transaction.
    result.pointsEarned = this.awardMilestoneBonus(levelBefore, this.state.level, result.evolved, result.newStage);

    // 8. lifetime stats for the pet-settings "Journey" card
    this.state.totalTransactions += 1;
    this.recordMerchant(merchant);
    this.updateStreak(today);

    // 9. save and done
    this.save();
    return result;
  }

  // Computes the NETS Points bonus for a level-up/evolution (optimistic —
  // same scale the backend uses, so the UI can show it immediately without
  // waiting on a network round trip) and fires a best-effort request to
  // credit it to the user's REAL points balance, the single source of truth
  // the Rewards tab reads from (see PointsService.getBalance). Returns 0,
  // and makes no request at all, when there's no milestone to reward.
  private awardMilestoneBonus(fromLevel: number, toLevel: number, evolved: boolean, newStage?: PetStage): number {
    let bonus = 0;
    for (let level = fromLevel + 1; level <= toLevel; level++) {
      bonus += levelUpBonus(level);
    }
    if (evolved) {
      bonus += EVOLVE_MILESTONE_BONUS;
    }
    if (bonus > 0) {
      this.http
        .post(`${API_BASE_URL}/users/${this.ownerId}/payogotchi/milestone-bonus`, {
          fromLevel,
          toLevel,
          evolved,
          newStage,
        })
        .subscribe({ next: () => {}, error: () => {} });
    }
    return bonus;
  }

  // tally the merchant name towards the favourite-merchant stat
  private recordMerchant(merchant?: string): void {
    const name = merchant?.trim();
    if (!name) {
      return;
    }
    this.state.merchantCounts[name] = (this.state.merchantCounts[name] ?? 0) + 1;
  }

  // extend/reset the daily streak based on when the last counted
  // transaction happened, and keep the longest-streak high-water mark
  private updateStreak(today: string): void {
    const last = this.state.lastTransactionDate;
    const gap = last ? this.daysBetween(last, today) : null;

    if (gap === 0) {
      return; // already counted a transaction today, streak unchanged
    }
    this.state.currentStreak = gap === 1 ? this.state.currentStreak + 1 : 1;
    this.state.lastTransactionDate = today;
    this.state.longestStreak = Math.max(this.state.longestStreak, this.state.currentStreak);
  }

  // whole-day difference between two 'YYYY-MM-DD' dates (b - a)
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

  // Grants the one-time tutorial completion bonus and reports whether it
  // levelled up / evolved the pet, so the caller can celebrate it the same
  // way a real transaction does. Returns null if already claimed before —
  // the tutorial can still be re-read, it just won't pay out XP again.
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

  // keep values between 0 and 100
  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  // today's date as 'YYYY-MM-DD', used for the daily XP counter
  private todayStr(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  // ---- Saving/loading ----
  //
  // Two layers: a per-user localStorage cache (instant, offline-safe) and
  // Firestore via the Node backend (real cloud persistence). Every screen
  // still just calls save() / reads state - the storage details live here.

  // localStorage cache key for a given user
  private cacheKey(owner: string): string {
    return `${STORAGE_KEY}_${owner}`;
  }

  // load the given user's pet from the local cache into memory. Starts from
  // a fresh state so a previous user's data never bleeds across an account
  // switch. For the fallback demo user we also adopt the legacy (pre
  // multi-user) save once, so the pet you already built carries over.
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
      // cache was broken - just keep the fresh state
    }
    this.loadedOwner = owner;
  }

  // Backfills journey-stat fields for pets saved before they existed, so an
  // already-onboarded returning pet doesn't show "0 days together" or a
  // reset lifetime XP total just because the save predates this feature.
  private migrateLegacyFields(): void {
    let changed = false;

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

  // Reconcile the in-memory pet with Firestore. Called by the entry guard
  // before it decides intro vs home, so a returning user never flashes the
  // intro and each account loads its own pet. Falls back to the local cache
  // when offline / the backend is down, so the demo never breaks.
  async syncFromCloud(): Promise<void> {
    const owner = this.ownerId;
    // account switched since last load - swap to that user's cached pet first
    if (this.loadedOwner !== owner) {
      this.loadLocalFor(owner);
    }

    try {
      const res = await firstValueFrom(
        this.http.get<{ pet: Partial<PetState> | null }>(
          `${API_BASE_URL}/users/${owner}/payogotchi`
        )
      );
      if (res?.pet) {
        // cloud is the source of truth on load
        Object.assign(this.state, res.pet);
        this.migrateLegacyFields();
        this.writeLocal();
      } else {
        // no cloud pet yet: promote whatever we have locally (first save /
        // legacy migration) so this user gets a Firestore document
        this.saveToCloud();
      }
    } catch {
      // offline or backend down - keep the local/default state
    }
  }

  // save the pet, called after every change. Writes the local cache
  // immediately and schedules a (debounced) Firestore write.
  private save(): void {
    this.writeLocal();
    this.scheduleCloudSave();
  }

  // write the current pet to this owner's local cache
  private writeLocal(): void {
    try {
      localStorage.setItem(this.cacheKey(this.ownerId), JSON.stringify(this.state));
    } catch {
      // storage full or blocked (private mode) - just keep going in memory
    }
  }

  // coalesce a burst of save() calls into a single Firestore write
  private scheduleCloudSave(): void {
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
    }
    this.cloudSaveTimer = setTimeout(() => this.saveToCloud(), 500);
  }

  // push the current pet to Firestore via the backend. Fire-and-forget:
  // a failure (offline) is fine because the local cache already holds it.
  private saveToCloud(): void {
    this.cloudSaveTimer = null;
    const owner = this.ownerId;
    this.http
      .put(`${API_BASE_URL}/users/${owner}/payogotchi`, { pet: this.state })
      .subscribe({ next: () => {}, error: () => {} });
  }
}
