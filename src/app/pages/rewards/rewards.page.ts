import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rewards',
  templateUrl: './rewards.page.html',
  styleUrls: ['./rewards.page.scss'],
  standalone: false,
})
export class RewardsPage {

  constructor(private router: Router) {}

  goToPointsBalance(): void {
    this.router.navigate(['/nets-points']);
  }

  goToMarketplace(): void {
    this.router.navigate(['/rewards-marketplace']);
  }

  goToVouchers(): void {
    this.router.navigate(['/my-vouchers']);
  }

  goToDailyQuests(): void {
    this.router.navigate(['/daily-quests']);
  }

  goToWeeklyQuests(): void {
    this.router.navigate(['/weekly-quests']);
  }

  goToPartnerChallenges(): void {
    this.router.navigate(['/partner-challenges']);
  }
}