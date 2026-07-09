import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

type VoucherTab = 'available' | 'used';

interface AvailableVoucher {
  name: string;
  description: string;
  points: number;
  emoji: string;
  redeemedOn: string;
  expiresOn: string;
}

interface UsedVoucher {
  name: string;
  description: string;
  points: number;
  emoji: string;
  redeemedOn: string;
  expiredOn: string;
  usedOn: string;
  location: string;
}

@Component({
  selector: 'app-my-vouchers',
  templateUrl: './my-vouchers.page.html',
  styleUrls: ['./my-vouchers.page.scss'],
  standalone: false,
})
export class MyVouchersPage implements OnInit {

  activeTab: VoucherTab = 'available';

  // TODO: replace with data from your vouchers service
  availableVouchers: AvailableVoucher[] = [
    {
      name: 'Popular Bookstore',
      description: '$10 Voucher',
      points: 1000,
      emoji: '📚',
      redeemedOn: '27 May 2026',
      expiresOn: '27 Aug 2026',
    },
    {
      name: 'Koi Thé',
      description: 'Free Upsize / BOGO Deal',
      points: 250,
      emoji: '🧋',
      redeemedOn: '25 May 2026',
      expiresOn: '25 Jun 2026',
    },
    {
      name: 'Starbucks',
      description: '$5 Beverage Voucher',
      points: 450,
      emoji: '☕',
      redeemedOn: '23 May 2026',
      expiresOn: '23 Jul 2026',
    },
  ];

  usedVouchers: UsedVoucher[] = [
    {
      name: 'Grab',
      description: '$5 Ride Voucher',
      points: 500,
      emoji: '🚗',
      redeemedOn: '15 May 2026',
      expiredOn: '15 Aug 2026',
      usedOn: '20 May 2026, 3:45 PM',
      location: 'Orchard Road to Marina Bay',
    },
    {
      name: 'Cathay Cineplexes',
      description: 'Movie Ticket Discount',
      points: 400,
      emoji: '🎬',
      redeemedOn: '10 May 2026',
      expiredOn: '10 Aug 2026',
      usedOn: '12 May 2026, 7:30 PM',
      location: 'Cathay Cineleisure Orchard',
    },
  ];

  constructor(private router: Router, private location: Location) {}

  ngOnInit(): void {}

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/rewards']);
    }
  }
}