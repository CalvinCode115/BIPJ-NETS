import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

interface MarketplaceReward {
  name: string;
  description: string;
  points: number;
  emoji: string;
}

@Component({
  selector: 'app-rewards-marketplace',
  templateUrl: './rewards-marketplace.page.html',
  styleUrls: ['./rewards-marketplace.page.scss'],
  standalone: false,
})
export class RewardsMarketplacePage implements OnInit {

  // TODO: replace with data from your rewards catalog service
  rewards: MarketplaceReward[] = [
    { name: 'Grab', description: '$5 Ride Voucher', points: 500, emoji: '🚗' },
    { name: 'Popular Bookstore', description: '$10 Voucher', points: 1000, emoji: '📚' },
    { name: 'Koi Thé', description: 'Free Upsize / BOGO Deal', points: 250, emoji: '🧋' },
    { name: 'Cathay Cineplexes', description: 'Movie Ticket Discount', points: 400, emoji: '🎬' },
    { name: 'Starbucks', description: '$5 Beverage Voucher', points: 450, emoji: '☕' },
    { name: 'Sephora', description: '$15 Beauty Voucher', points: 1200, emoji: '💄' },
  ];

  constructor(private router: Router, private location: Location) {}

  ngOnInit(): void {}

  redeem(reward: MarketplaceReward): void {
    // TODO: call your rewards service to redeem, check balance, and confirm,
    // e.g. this.rewardsService.redeem(reward).subscribe(() => this.router.navigate(['/my-vouchers']));
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/rewards']);
    }
  }
}