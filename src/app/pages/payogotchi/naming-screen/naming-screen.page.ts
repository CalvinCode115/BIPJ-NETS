import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { PetService } from '../../../services/pet.service';

@Component({
  selector: 'app-naming-screen',
  templateUrl: './naming-screen.page.html',
  styleUrls: ['./naming-screen.page.scss'],
  standalone: false,
})
export class NamingScreenPage {
  /** The name the user is typing for their new Tapatchi. */
  petName = '';

  /** Max length shown in the counter and enforced on the input. */
  readonly maxLength = 12;

  /** Quick-pick names from the Figma design. */
  readonly suggestions = ['Boba', 'Mochi', 'Bubbles', 'Sparky'];

  /** Egg visuals carried forward from the hatch flow (passed on to Home). */
  private egg = { gradient: 'linear-gradient(160deg, #4a4a4a, #1a1a1a)', emoji: '💎', rare: true };

  private readonly nextRoute = '/tabs/payogotchi/payogotchi-home';

  constructor(private router: Router, private location: Location, private petService: PetService) {
    const egg = this.router.getCurrentNavigation()?.extras?.state?.['egg'];
    if (egg) {
      this.egg = { gradient: egg.gradient ?? this.egg.gradient, emoji: egg.emoji ?? '', rare: !!egg.rare };
    }
  }

  get trimmedName(): string {
    return this.petName.trim();
  }

  get hasName(): boolean {
    return this.trimmedName.length > 0;
  }

  /** Speech-bubble copy reacts to what the user has typed. */
  get bubbleText(): string {
    return this.hasName
      ? `"${this.trimmedName}" sounds perfect! 💕`
      : 'What should we call your new friend? 🥰';
  }

  /** Tap a suggestion pill to fill the name field. */
  pickSuggestion(name: string): void {
    this.petName = name.slice(0, this.maxLength);
  }

  goBack(): void {
    this.location.back();
  }

  /** "Confirm Name" — save the name and head to Payogotchi Home. */
  confirmName(): void {
    if (!this.hasName) {
      return;
    }
    // Persist the name so Home and every other screen can read it.
    this.petService.setName(this.trimmedName);
    this.router.navigate([this.nextRoute], {
      state: { petName: this.trimmedName, egg: this.egg },
    });
  }
}
