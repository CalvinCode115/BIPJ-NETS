import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

interface PointsHistoryItem {
  title: string;
  timestamp: string;
  amount: number;
  icon: string;
  type: 'quest' | 'challenge' | 'streak' | 'pet' | 'redeem';
}

@Component({
  selector: 'app-nets-points',
  templateUrl: './nets-points.page.html',
  styleUrls: ['./nets-points.page.scss'],
  standalone: false,
})
export class NetsPointsPage implements OnInit {

  totalPoints = 3750;
  earnedThisWeek = 830;
  spentThisWeek = 200;

  // TODO: replace with data from your rewards/points service
  pointsHistory: PointsHistoryItem[] = [
    { title: 'Completed Weekly Challenge: Big Week', timestamp: 'Today, 2:30 PM', amount: 200, icon: 'trophy-outline', type: 'challenge' },
    { title: 'Redeemed LiHO Bubble Tea Voucher', timestamp: 'Yesterday', amount: -200, icon: 'gift-outline', type: 'redeem' },
    { title: 'Daily Check-In Streak Bonus', timestamp: 'Yesterday', amount: 50, icon: 'sparkles-outline', type: 'streak' },
    { title: 'Evolved Paycotchi Pet to Level 5', timestamp: '3 days ago', amount: 150, icon: 'heart-outline', type: 'pet' },
    { title: 'Completed Daily Quest: Coffee Run', timestamp: '3 days ago', amount: 30, icon: 'trophy-outline', type: 'quest' },
    { title: 'Redeemed Popular Bookstore Voucher', timestamp: '5 days ago', amount: -1000, icon: 'gift-outline', type: 'redeem' },
    { title: 'Partner Challenge: Dim Sum Delight', timestamp: '6 days ago', amount: 200, icon: 'trophy-outline', type: 'challenge' },
    { title: 'Weekly Quest: Social Butterfly', timestamp: '1 week ago', amount: 400, icon: 'trophy-outline', type: 'quest' },
  ];

  constructor(private router: Router, private location: Location) {}

  ngOnInit(): void {}

  goBack(): void {
    // Location.back() reliably returns to the previous screen (the Rewards page)
    // regardless of how this page is nested in the route tree (e.g. under a tabs route).
    // this.router.navigate(['/rewards']) can silently fail to navigate if the actual
    // path is something like '/tabs/rewards', which was likely why the button wasn't working.
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/rewards']);
    }
  }

  sendPointsToFriends(): void {
    this.router.navigate(['/send-points']);
  }

  goToPointHistory(): void {
    this.router.navigate(['/point-history']);
  }
}