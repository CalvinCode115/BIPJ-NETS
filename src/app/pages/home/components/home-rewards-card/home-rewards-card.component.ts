import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PetState } from '../../../../models/pet.model';

@Component({
  selector: 'app-home-rewards-card',
  templateUrl: './home-rewards-card.component.html',
  styleUrls: ['./home-rewards-card.component.scss'],
  standalone: false,
})
export class HomeRewardsCardComponent {
  @Input() currentPoints = 0;
  @Input() targetPoints = 5000;
  @Input() pet: PetState | null = null;
  /** 0–100 fill for the Payogotchi XP bar */
  @Input() xpPercent = 0;

  @Output() openPayogotchi = new EventEmitter<void>();

  get rewardsProgress(): number {
    if (!this.targetPoints) {
      return 0;
    }
    return Math.min(100, (this.currentPoints / this.targetPoints) * 100);
  }

  get onboarded(): boolean {
    return Boolean(this.pet?.onboarded);
  }

  onTeaserClick(): void {
    this.openPayogotchi.emit();
  }
}
