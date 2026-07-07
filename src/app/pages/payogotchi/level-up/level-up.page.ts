import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PetService } from '../../../services/pet.service';

@Component({
  selector: 'app-level-up',
  templateUrl: './level-up.page.html',
  styleUrls: ['./level-up.page.scss'],
  standalone: false,
})
export class LevelUpPage {
  readonly beforeLevel: number;
  readonly nowLevel: number;
  /** NETS Points awarded for the level-up (Figma shows a flat +50). */
  readonly reward = 50;

  constructor(private router: Router, private petService: PetService) {
    // Illustrative: celebrate reaching the next level (kept replayable).
    this.beforeLevel = this.petService.state.level;
    this.nowLevel = this.beforeLevel + 1;
  }

  get petName(): string {
    return this.petService.state.name;
  }

  /** "Continue" — return to Home. */
  continue(): void {
    this.router.navigate(['/tabs/payogotchi/payogotchi-home']);
  }
}
