import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

type FilterType = 'all' | 'earned' | 'spent';

interface Transaction {
  title: string;
  timestamp: string;
  amount: number;
  icon: string;
  type: 'quest' | 'redemption' | 'bonus' | 'achievement' | 'challenge' | 'transfer' | 'transaction' | 'cosmetic';
  tag: string;
}

@Component({
  selector: 'app-point-history',
  templateUrl: './point-history.page.html',
  styleUrls: ['./point-history.page.scss'],
  standalone: false,
})
export class PointHistoryPage implements OnInit {

  activeFilter: FilterType = 'all';

  // TODO: replace with data fetched from your points service (e.g. paginated API call)
  allTransactions: Transaction[] = [
    { title: 'Completed Weekly Challenge: Big Week', timestamp: 'Today, 2:30 PM', amount: 200, icon: 'trophy-outline', type: 'quest', tag: 'Quest' },
    { title: 'Redeemed LiHO Bubble Tea Voucher', timestamp: 'Yesterday', amount: -200, icon: 'gift-outline', type: 'redemption', tag: 'Redemption' },
    { title: 'Daily Check-In Streak Bonus', timestamp: 'Yesterday', amount: 50, icon: 'sparkles-outline', type: 'bonus', tag: 'Bonus' },
    { title: 'Evolved Paycotchi Pet to Level 5', timestamp: '3 days ago', amount: 150, icon: 'heart-outline', type: 'achievement', tag: 'Achievement' },
    { title: 'Completed Daily Quest: Coffee Run', timestamp: '3 days ago', amount: 30, icon: 'trophy-outline', type: 'quest', tag: 'Quest' },
    { title: 'Redeemed Popular Bookstore Voucher', timestamp: '5 days ago', amount: -1000, icon: 'gift-outline', type: 'redemption', tag: 'Redemption' },
    { title: 'Partner Challenge: Dim Sum Delight', timestamp: '6 days ago', amount: 200, icon: 'trophy-outline', type: 'challenge', tag: 'Challenge' },
    { title: 'Weekly Quest: Social Butterfly', timestamp: '1 week ago', amount: 400, icon: 'trophy-outline', type: 'quest', tag: 'Quest' },
    { title: 'Sent Points to Alex Chen', timestamp: '1 week ago', amount: -500, icon: 'paper-plane-outline', type: 'transfer', tag: 'Transfer' },
    { title: 'Purchased Coffee at Starbucks', timestamp: '1 week ago', amount: 25, icon: 'cafe-outline', type: 'transaction', tag: 'Transaction' },
    { title: 'Daily Quest: Explorer', timestamp: '1 week ago', amount: 100, icon: 'trophy-outline', type: 'quest', tag: 'Quest' },
    { title: 'Redeemed Latte Art Background', timestamp: '2 weeks ago', amount: -400, icon: 'gift-outline', type: 'cosmetic', tag: 'Cosmetic' },
    { title: 'Weekly Streak: 4 Weeks', timestamp: '2 weeks ago', amount: 300, icon: 'sparkles-outline', type: 'bonus', tag: 'Bonus' },
    { title: 'Completed Daily Quest: Big Spender', timestamp: '2 weeks ago', amount: 200, icon: 'trophy-outline', type: 'quest', tag: 'Quest' },
    { title: 'Received Points from Priya Kumar', timestamp: '2 weeks ago', amount: 250, icon: 'paper-plane-outline', type: 'transfer', tag: 'Transfer' },
    { title: 'Partner Challenge: Shopping Spree', timestamp: '3 weeks ago', amount: 350, icon: 'trophy-outline', type: 'challenge', tag: 'Challenge' },
    { title: 'Redeemed Grab Ride Voucher', timestamp: '3 weeks ago', amount: -500, icon: 'gift-outline', type: 'redemption', tag: 'Redemption' },
    { title: 'Daily Quest: First Transaction', timestamp: '3 weeks ago', amount: 50, icon: 'trophy-outline', type: 'quest', tag: 'Quest' },
    { title: 'Pet Feeding Streak Bonus', timestamp: '3 weeks ago', amount: 75, icon: 'sparkles-outline', type: 'bonus', tag: 'Bonus' },
    { title: 'Weekly Challenge: Foodie Adventure', timestamp: '1 month ago', amount: 450, icon: 'trophy-outline', type: 'challenge', tag: 'Challenge' },
    { title: 'Redeemed Mystery Box', timestamp: '1 month ago', amount: -200, icon: 'gift-outline', type: 'cosmetic', tag: 'Cosmetic' },
    { title: 'Sent Points to Jamie Tan', timestamp: '1 month ago', amount: -300, icon: 'paper-plane-outline', type: 'transfer', tag: 'Transfer' },
    { title: 'Welcome Bonus', timestamp: '2 months ago', amount: 1000, icon: 'sparkles-outline', type: 'bonus', tag: 'Bonus' },
    { title: 'First Purchase Reward', timestamp: '2 months ago', amount: 500, icon: 'heart-outline', type: 'achievement', tag: 'Achievement' },
  ];

  filteredTransactions: Transaction[] = [];

  constructor(private router: Router, private location: Location) {}

  ngOnInit(): void {
    this.applyFilter();
  }

  get counts() {
    return {
      all: this.allTransactions.length,
      earned: this.allTransactions.filter(t => t.amount > 0).length,
      spent: this.allTransactions.filter(t => t.amount < 0).length,
    };
  }

  get sectionTitle(): string {
    switch (this.activeFilter) {
      case 'earned': return 'Earned Transactions';
      case 'spent': return 'Spent Transactions';
      default: return 'All Transactions';
    }
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  private applyFilter(): void {
    switch (this.activeFilter) {
      case 'earned':
        this.filteredTransactions = this.allTransactions.filter(t => t.amount > 0);
        break;
      case 'spent':
        this.filteredTransactions = this.allTransactions.filter(t => t.amount < 0);
        break;
      default:
        this.filteredTransactions = this.allTransactions;
    }
  }

  goBack(): void {
    // Using Location.back() (not router.navigate) is essential here: navigate() pushes
    // a NEW history entry, which was corrupting the stack and causing the NETS Points
    // page's back arrow to land back on this page instead of Rewards.
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/nets-points']);
    }
  }
}