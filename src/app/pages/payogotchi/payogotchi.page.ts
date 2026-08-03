import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TapatchiMood } from '../../components/tapatchi/tapatchi.component';
import { PetService } from '../../services/pet.service';

@Component({
  selector: 'app-payogotchi',
  templateUrl: 'payogotchi.page.html',
  styleUrls: ['payogotchi.page.scss'],
  standalone: false,

})
export class PayogotchiPage implements OnInit {
  currentMood: TapatchiMood = 'happy';

  moods: TapatchiMood[] = ['happy', 'normal', 'sad', 'starving', 'sleeping', 'excited'];

  constructor(private router: Router, private petService: PetService) {}

  ngOnInit() {}

  setMood(mood: TapatchiMood) {
    this.currentMood = mood;
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
