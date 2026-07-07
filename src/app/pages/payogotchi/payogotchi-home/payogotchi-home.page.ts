import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PetService } from '../../../services/pet.service';
import { PetState, TxnCategory } from '../../../models/pet.model';

interface DemoTxn {
  label: string;
  amount: number;
  category: TxnCategory;
  /** Tailwind-free styling hook: 'coffee' | 'lunch' | 'shop'. */
  theme: 'coffee' | 'lunch' | 'shop';
}

interface Quest {
  label: string;
  done: boolean;
  /** Reward chip, e.g. "+30 Happy". */
  reward: string;
  rewardTheme: 'done' | 'happy';
}

@Component({
  selector: 'app-payogotchi-home',
  templateUrl: './payogotchi-home.page.html',
  styleUrls: ['./payogotchi-home.page.scss'],
  standalone: false,
})
export class PayogotchiHomePage {
  /** Live reference to the shared pet state (mutations reflect instantly). */
  readonly pet: PetState;

  readonly demoTxns: DemoTxn[] = [
    { label: '☕ Coffee $5', amount: 5, category: 'other', theme: 'coffee' },
    { label: '🍜 Lunch $12', amount: 12, category: 'food', theme: 'lunch' },
    { label: '🛍️ Shop $25', amount: 25, category: 'shopping', theme: 'shop' },
  ];

  readonly quests: Quest[] = [
    { label: 'Make first transaction', done: true, reward: '✓ Done', rewardTheme: 'done' },
    { label: 'Eat at hawker stall', done: false, reward: '+30 Happy', rewardTheme: 'happy' },
  ];

  constructor(private router: Router, private petService: PetService) {
    this.pet = this.petService.state;
  }

  // ---- Derived display state (delegated to the service) ----
  get mood() {
    return this.petService.mood;
  }

  get statusText(): string {
    return this.petService.statusText;
  }

  get xpPercent(): number {
    return this.petService.xpProgress * 100;
  }

  // ---- Care actions ----
  runTransaction(txn: DemoTxn): void {
    this.petService.applyTransaction(txn.amount, txn.category);
    // TODO: route to transaction-feedback (screen 06) once that screen is built.
  }

  feed(): void {
    this.petService.feed();
  }

  // ---- Navigation ----
  private go(screen: string): void {
    this.router.navigate([`/tabs/payogotchi/${screen}`]);
  }

  openMiniGame(): void {
    this.go('mini-game');
  }
  openDressUp(): void {
    this.go('cosmetics-dressup');
  }
  openSettings(): void {
    this.go('pet-settings');
  }
  openLevelUp(): void {
    this.go('level-up');
  }
  openEvolve(): void {
    this.go('stage-evolution');
  }
  openFaint(): void {
    this.go('fainted-pet');
  }
  openReturn(): void {
    this.go('welcome-back');
  }
  openQuests(): void {
    // Quests live on Yunen's Rewards tab; placeholder until wired.
  }
}
