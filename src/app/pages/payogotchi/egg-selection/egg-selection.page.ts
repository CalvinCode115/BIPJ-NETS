import { Component } from '@angular/core';
import { Router } from '@angular/router';

export interface EggOption {
  id: number;
  label: string;
  /** CSS gradient for the egg body */
  gradient: string;
  /** Visual treatment applied on top of the egg body */
  pattern: 'dots' | 'stripes' | 'spots' | 'emoji';
  /** Emoji shown when pattern === 'emoji' */
  emoji?: string;
  /** Marks the special dark "RARE" egg */
  rare?: boolean;
}

@Component({
  selector: 'app-egg-selection',
  templateUrl: './egg-selection.page.html',
  styleUrls: ['./egg-selection.page.scss'],
  standalone: false,
})
export class EggSelectionPage {
  /** The eight mystery eggs, matching the Figma "Egg Selection" frame (4781:429). */
  eggs: EggOption[] = [
    { id: 1, label: 'Mystery #1', gradient: 'linear-gradient(160deg, #ffd1dc, #ff9eb5)', pattern: 'dots' },
    { id: 2, label: 'Mystery #2', gradient: 'linear-gradient(160deg, #bfe3ff, #7fc4ff)', pattern: 'stripes' },
    { id: 3, label: 'Mystery #3', gradient: 'linear-gradient(160deg, #c8f0d0, #9be0a8)', pattern: 'spots' },
    { id: 4, label: 'Mystery #4', gradient: 'linear-gradient(160deg, #ffe9a8, #ffd35a)', pattern: 'emoji', emoji: '⭐' },
    { id: 5, label: 'Mystery #5', gradient: 'linear-gradient(160deg, #e4d4f7, #c9a8ee)', pattern: 'emoji', emoji: '✨' },
    { id: 6, label: 'Mystery #6', gradient: 'linear-gradient(160deg, #ffc9a3, #ff8a4c)', pattern: 'emoji', emoji: '🔥' },
    { id: 7, label: 'Mystery #7', gradient: 'linear-gradient(160deg, #ededed, #d0d0d0)', pattern: 'emoji', emoji: '☁️' },
    { id: 8, label: 'Mystery #8', gradient: 'linear-gradient(160deg, #4a4a4a, #1a1a1a)', pattern: 'emoji', emoji: '💎', rare: true },
  ];

  selectedEggId: number | null = null;
  /** The egg whose confirmation popup is currently open (null = closed). */
  selectedEgg: EggOption | null = null;

  // Screen 02 in the onboarding flow. The route/module doesn't exist yet —
  // wire it up when Hatching Progress is built.
  private readonly nextRoute = '/tabs/payogotchi/hatching-progress';

  constructor(private router: Router) {}

  /** Tapping an egg opens the confirmation popup for that egg. */
  selectEgg(egg: EggOption): void {
    this.selectedEgg = egg;
    this.selectedEggId = egg.id;
  }

  /** "Choose Different" — dismiss the popup and clear the selection. */
  chooseDifferent(): void {
    this.selectedEgg = null;
    this.selectedEggId = null;
  }

  /** "Confirm Choice" — proceed to the hatching flow with the chosen egg. */
  confirmChoice(): void {
    if (!this.selectedEgg) {
      return;
    }
    this.router.navigate([this.nextRoute], { state: { egg: this.selectedEgg } });
  }

  trackByEggId(_index: number, egg: EggOption): number {
    return egg.id;
  }
}
