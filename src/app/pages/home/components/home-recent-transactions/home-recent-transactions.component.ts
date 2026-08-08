import { Component, EventEmitter, Input, Output } from '@angular/core';
import { HomeRecentTransaction } from '../../services/home-activity.service';

@Component({
  selector: 'app-home-recent-transactions',
  templateUrl: './home-recent-transactions.component.html',
  styleUrls: ['./home-recent-transactions.component.scss'],
  standalone: false,
})
export class HomeRecentTransactionsComponent {
  @Input() transactions: HomeRecentTransaction[] = [];
  @Output() seeAll = new EventEmitter<void>();

  formatAmount(amount: number): string {
    const prefix = amount >= 0 ? '+' : '-';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  }

  onSeeAll(): void {
    this.seeAll.emit();
  }
}
