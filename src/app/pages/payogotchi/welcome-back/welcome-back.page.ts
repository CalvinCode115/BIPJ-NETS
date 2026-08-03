import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PetService } from '../../../services/pet.service';

// one falling confetti square
interface ConfettiPiece {
  left: number; // % across the screen
  delay: number; // seconds before it starts falling
  duration: number; // how long one fall takes (s)
  color: string; // pastel colour from the theme
}

@Component({
  selector: 'app-welcome-back',
  templateUrl: './welcome-back.page.html',
  styleUrls: ['./welcome-back.page.scss'],
  standalone: false,
})
export class WelcomeBackPage {
  // welcome back bonus amounts (from the design: +200 XP / +50 NETS)
  readonly xpBonus = 200;
  readonly netsBonus = 50;

  readonly confetti: ConfettiPiece[] = [];

  constructor(private router: Router, private petService: PetService) {
    // scatter some pastel confetti randomly like in the design
    const colors = ['#ffe066', '#d4bbff', '#b2f2bb', '#ffb6c1'];
    for (let i = 0; i < 18; i++) {
      this.confetti.push({
        left: Math.random() * 92 + 4,
        delay: Math.random() * 4,
        duration: 3 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
  }

  get petName(): string {
    return this.petService.state.name;
  }

  // "Continue Playing" button - back to Home
  continue(): void {
    this.router.navigate(['/tabs/payogotchi/payogotchi-home']);
  }
}
