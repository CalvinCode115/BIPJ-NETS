import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-send-points',
  templateUrl: './send-points.page.html',
  styleUrls: ['./send-points.page.scss'],
  standalone: false,
})
export class SendPointsPage {

  balance = 2450;
  contactNumber = '';
  amount: number | null = null;
  comment = '';

  quickAmounts = [100, 250, 500, 1000];

  constructor(private router: Router, private location: Location) {}

  get isFormValid(): boolean {
    return (
      this.contactNumber.length === 8 &&
      !!this.amount &&
      this.amount > 0 &&
      this.amount <= this.balance
    );
  }

  selectQuickAmount(value: number): void {
    this.amount = value;
  }

  sendPoints(): void {
    if (!this.isFormValid) {
      return;
    }
    // TODO: call your points service to submit the transfer, e.g.
    // this.pointsService.sendPoints(this.contactNumber, this.amount, this.comment)
    //   .subscribe(() => this.router.navigate(['/nets-points']));
  }

  goBackToBalance(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/nets-points']);
    }
  }
}