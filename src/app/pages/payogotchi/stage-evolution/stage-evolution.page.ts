import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PetService } from '../../../services/pet.service';
import { PetStage } from '../../../models/pet.model';

interface Particle {
  left: number; // %
  top: number; // %
  size: number; // px
  color: string;
  opacity: number;
  delay: number; // s
}

@Component({
  selector: 'app-stage-evolution',
  templateUrl: './stage-evolution.page.html',
  styleUrls: ['./stage-evolution.page.scss'],
  standalone: false,
})
export class StageEvolutionPage {
  readonly fromStage: PetStage;
  readonly toStage: PetStage;
  readonly unlocks: string[];
  readonly particles: Particle[] = this.buildParticles();

  constructor(private router: Router, private petService: PetService) {
    // show the evolution from the pet's current stage to the next one
    const current = this.petService.state.stage;
    this.fromStage = current === 'Adult' ? 'Teen' : current;
    this.toStage = this.nextStage(this.fromStage);
    this.unlocks = this.unlocksFor(this.toStage);
  }

  get petName(): string {
    return this.petService.state.name;
  }

  // "Meet New Angel!" button - back to Home
  meetNewPet(): void {
    this.router.navigate(['/tabs/payogotchi/payogotchi-home']);
  }

  private nextStage(stage: PetStage): PetStage {
    return stage === 'Baby' ? 'Teen' : 'Adult';
  }

  /** Perks listed on the evolution popup. Mirrored in payogotchi-home.page.ts. */
  private unlocksFor(stage: PetStage): string[] {
    if (stage === 'Adult') {
      return ['Max XP cap (600 / day)', 'Prestige features'];
    }
    return ['Bigger XP cap (400 / day)', 'New mini-games'];
  }

  private buildParticles(): Particle[] {
    const colors = ['#ffd700', '#d4bbff', '#87ceeb', '#ffb6c1'];
    const particles: Particle[] = [];
    for (let i = 0; i < 22; i++) {
      particles.push({
        left: Math.random() * 96,
        top: Math.random() * 96,
        size: 2 + Math.random() * 5,
        color: colors[i % colors.length],
        opacity: 0.25 + Math.random() * 0.6,
        delay: Math.random() * 3,
      });
    }
    return particles;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
