import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

interface HatchTransaction {
  merchant: string;
  time: string;
  xp: number;
}

@Component({
  selector: 'app-hatching-progress',
  templateUrl: './hatching-progress.page.html',
  styleUrls: ['./hatching-progress.page.scss'],
  standalone: false,
})
export class HatchingProgressPage {
  /** Transactions required to hatch the egg. */
  readonly goal = 5;

  /** ONE screen, many states: 0–5 completed NETS transactions. */
  transactionCount = 5;

  /** Demo shortcuts (the 1/5, 3/5, 5/5 pills in the design). */
  readonly demoStates = [1, 3, 5];

  /** The five slots. The first `transactionCount` are treated as completed. */
  readonly transactions: HatchTransaction[] = [
    { merchant: 'Koufu Food Court', time: '10:45 AM', xp: 20 },
    { merchant: 'Bus Ride 65', time: '09:12 AM', xp: 20 },
    { merchant: 'FairPrice Xtra', time: 'Yesterday', xp: 20 },
    { merchant: '7-Eleven', time: 'Yesterday', xp: 20 },
    { merchant: 'Kopitiam', time: '2 days ago', xp: 20 },
  ];

  /** Egg visuals, carried from the Egg Selection screen (with a sensible default). */
  eggGradient = 'linear-gradient(160deg, #4a4a4a, #1a1a1a)';
  eggEmoji = '💎';
  eggRare = true;

  constructor(private router: Router, private location: Location) {
    const egg = this.router.getCurrentNavigation()?.extras?.state?.['egg'];
    if (egg) {
      this.eggGradient = egg.gradient ?? this.eggGradient;
      this.eggEmoji = egg.emoji ?? '';
      this.eggRare = !!egg.rare;
    }
  }

  get isReady(): boolean {
    return this.transactionCount >= this.goal;
  }

  get remaining(): number {
    return Math.max(this.goal - this.transactionCount, 0);
  }

  /** 0 → 1 fill factor used for the glow and crack intensity. */
  get progress(): number {
    return this.transactionCount / this.goal;
  }

  get heading(): string {
    if (this.isReady) {
      return 'Ready to Hatch! 🌟';
    }
    return this.transactionCount === 0 ? 'Your Egg Awaits 🥚' : 'Almost There! 🥚';
  }

  get primaryLine(): string {
    if (this.isReady) {
      return 'Your Tapatchi is breaking free!';
    }
    const plural = this.remaining === 1 ? '' : 's';
    return `${this.remaining} more transaction${plural} to go!`;
  }

  get secondaryLine(): string {
    return this.isReady
      ? 'Your egg is READY TO HATCH! Tap the button! 🎉'
      : 'Keep paying with NETS to hatch your egg.';
  }

  get tipText(): string {
    return this.isReady
      ? 'Amazing! Your Tapatchi has absorbed enough energy to hatch!'
      : 'Each NETS transaction feeds energy into your egg. 5 transactions will hatch it!';
  }

  /** Transaction rows with their completed/pending flag for the template. */
  get rows(): (HatchTransaction & { done: boolean })[] {
    return this.transactions.map((txn, i) => ({ ...txn, done: i < this.transactionCount }));
  }

  setDemoState(count: number): void {
    this.transactionCount = count;
  }

  goBack(): void {
    this.location.back();
  }

  hatch(): void {
    if (!this.isReady) {
      return;
    }
    this.router.navigate(['/tabs/payogotchi/hatching-animation'], {
      state: { egg: { gradient: this.eggGradient, emoji: this.eggEmoji, rare: this.eggRare } },
    });
  }
}
