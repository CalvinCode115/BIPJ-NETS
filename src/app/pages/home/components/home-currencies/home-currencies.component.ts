import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CardCurrencyBalance } from '../../../../services/card-linked-exchange.service';
import { HomeWalletService } from '../../services/home-wallet.service';

@Component({
  selector: 'app-home-currencies',
  templateUrl: './home-currencies.component.html',
  styleUrls: ['./home-currencies.component.scss'],
  standalone: false,
})
export class HomeCurrenciesComponent {
  @Input() balances: CardCurrencyBalance[] = [];
  @Output() exchange = new EventEmitter<void>();

  constructor(private readonly homeWallet: HomeWalletService) {}

  formatAmount(curr: CardCurrencyBalance): string {
    return this.homeWallet.formatMultiCurrencyAmount(curr);
  }
}
