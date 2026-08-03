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
  // NETS points given for levelling up (design shows a flat +50)
  readonly reward = 50;

  constructor(private router: Router, private petService: PetService) {
    // celebrate going from the current level to the next one
    this.beforeLevel = this.petService.state.level;
    this.nowLevel = this.beforeLevel + 1;
  }

  get petName(): string {
    return this.petService.state.name;
  }

  // "Continue" button - back to Home
  continue(): void {
    this.router.navigate(['/tabs/payogotchi/payogotchi-home']);
  }
}
