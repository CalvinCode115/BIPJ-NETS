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
  // the name being typed for the new pet
  petName = '';

  // max name length (shown in the counter too)
  readonly maxLength = 12;

  // quick pick name suggestions from the design
  readonly suggestions = ['Boba', 'Mochi', 'Bubbles', 'Sparky'];

  // egg look passed along from the hatching screens
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

  // speech bubble text changes based on what's typed
  get bubbleText(): string {
    return this.hasName
      ? `"${this.trimmedName}" sounds perfect! 💕`
      : 'What should we call your new friend? 🥰';
  }

  // tap a suggestion pill to fill in the name
  pickSuggestion(name: string): void {
    this.petName = name.slice(0, this.maxLength);
  }

  goBack(): void {
    this.location.back();
  }

  // "Confirm Name" button - save the name and go to Home
  confirmName(): void {
    if (!this.hasName) {
      return;
    }
    // save the name and mark onboarding done, so next time the
    // payogotchi tab goes straight to Home
    this.petService.setName(this.trimmedName);
    this.petService.completeOnboarding();
    this.router.navigate([this.nextRoute], {
      state: { petName: this.trimmedName, egg: this.egg },
    });
  }
}
