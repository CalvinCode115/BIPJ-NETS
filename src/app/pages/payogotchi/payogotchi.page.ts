import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  TAPATCHI_VARIANTS,
  TapatchiMood,
  TapatchiVariant,
  VARIANT_DISPLAY_NAMES,
} from '../../components/tapatchi/tapatchi.component';
import { PetService } from '../../services/pet.service';

@Component({
  selector: 'app-payogotchi',
  templateUrl: 'payogotchi.page.html',
  styleUrls: ['payogotchi.page.scss'],
  standalone: false,

})
export class PayogotchiPage implements OnInit {
  currentMood: TapatchiMood = 'happy';
  currentVariant: TapatchiVariant = 'green';

  moods: TapatchiMood[] = ['happy', 'normal', 'sad', 'starving', 'sleeping', 'excited', 'fainted'];

  // All 8 characters: the original inline green one plus the 7 from Figma.
  variants: TapatchiVariant[] = TAPATCHI_VARIANTS;
  variantNames = VARIANT_DISPLAY_NAMES;

  // Whether the grid animates. Eight characters x seven moods is 56 running
  // animations, so it's off by default and can be switched on to spot-check.
  gridAnimated = false;

  constructor(private router: Router, private petService: PetService) {}

  ngOnInit() {}

  setMood(mood: TapatchiMood) {
    this.currentMood = mood;
  }

  setVariant(variant: TapatchiVariant) {
    this.currentVariant = variant;
  }

  /** Which moods this character has real Figma artwork for. */
  isDrawnPose(variant: TapatchiVariant, mood: TapatchiMood): boolean {
    if (variant === 'green') {
      return mood !== 'fainted'; // green is drawn inline for every mood but fainted
    }
    if (mood === 'happy' || mood === 'fainted') {
      return true;
    }
    return mood === 'excited' && (variant === 'black' || variant === 'purple');
  }

  /** Demo: reset to a fresh new user and run the intro → egg journey. */
  demoNewUser(): void {
    this.petService.resetNewUser();
    this.router.navigateByUrl('/tabs/payogotchi');
  }

  /** Demo: seed the returning near-level-up user and land on Home. */
  demoReturningUser(): void {
    this.petService.seedReturningUser();
    this.router.navigateByUrl('/tabs/payogotchi');
  }
}
