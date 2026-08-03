import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { PetService } from '../../../services/pet.service';

// how much hunger the reviving food transaction gives back
const REVIVE_HUNGER = 60;

@Component({
  selector: 'app-fainted-pet',
  templateUrl: './fainted-pet.page.html',
  styleUrls: ['./fainted-pet.page.scss'],
  standalone: false,
})
export class FaintedPetPage {
  constructor(
    private pet: PetService,
    private router: Router,
    private location: Location,
  ) {}

  get name(): string {
    return this.pet.state.name;
  }

  // ---- Meter values (read straight from the shared pet state) ----
  get xp(): number {
    return this.pet.state.xp;
  }
  get xpMax(): number {
    return this.pet.state.xpMax;
  }
  get xpPercent(): number {
    return Math.round(this.pet.xpProgress * 100);
  }

  get happiness(): number {
    return this.pet.state.happiness;
  }

  get hunger(): number {
    return this.pet.state.hunger;
  }

  get isStarving(): boolean {
    return this.pet.state.hunger <= 15;
  }

  // pretend a food transaction happened - revive the pet and celebrate
  reviveWithFood(): void {
    this.pet.feed(REVIVE_HUNGER);
    this.router.navigate(['/tabs/payogotchi/welcome-back']);
  }

  back(): void {
    this.location.back();
  }
}
