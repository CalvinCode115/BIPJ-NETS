import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import {
  CardsService,
  formatCardPaymentLabel,
  ReceiveSettings,
  WalletCard,
} from '../services/cards.service';
import { CardContextService } from '../services/card-context.service';

@Component({
  selector: 'app-card-management',
  templateUrl: './home-card-management.page.html',
  styleUrls: ['./home-card-management.page.scss'],
  standalone: false,
})
export class CardManagementPage {
  cards: WalletCard[] = [];
  receiveSettings: ReceiveSettings | null = null;
  pageError = '';
  pageMessage = '';
  isLoading = true;
  unlinkingCardId = '';
  settingDefaultId = '';

  readonly formatCardPaymentLabel = formatCardPaymentLabel;

  constructor(
    private router: Router,
    private auth: AuthService,
    private cardsService: CardsService,
    private cardContext: CardContextService
  ) {}

  ionViewWillEnter(): void {
    this.loadData();
  }

  goBack(): void {
    this.router.navigate(['/tabs/home/home-more']);
  }

  isDefaultReceive(card: WalletCard): boolean {
    return Boolean(card.isDefaultReceive) || this.receiveSettings?.defaultCardId === card.id;
  }

  canSetDefaultReceive(card: WalletCard): boolean {
    return card.cardType === 'others' && card.accountKind === 'debit';
  }

  cardTypeLabel(card: WalletCard): string {
    if (card.cardType === 'prepaid') {
      return 'Prepaid';
    }
    if (card.cardType === 'cashcard') {
      return 'CashCard';
    }
    return card.accountKind === 'credit' ? 'Linked credit' : 'Linked debit';
  }

  setDefaultReceive(card: WalletCard): void {
    const userId = this.auth.userId;
    if (!userId || !this.canSetDefaultReceive(card)) {
      return;
    }

    this.pageError = '';
    this.settingDefaultId = card.id;

    this.cardsService.setDefaultReceive(userId, card.id).subscribe({
      next: (response) => {
        this.settingDefaultId = '';
        this.pageMessage = response.message;
        this.loadData();
      },
      error: (err: { error?: { error?: string } }) => {
        this.settingDefaultId = '';
        this.pageError = err?.error?.error ?? 'Unable to update default receive account.';
      },
    });
  }

  confirmUnlink(card: WalletCard): void {
    const label = formatCardPaymentLabel(card);
    const confirmed = window.confirm(`Remove ${label} from your wallet?`);
    if (!confirmed) {
      return;
    }

    this.unlinkCard(card);
  }

  private unlinkCard(card: WalletCard): void {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    this.pageError = '';
    this.pageMessage = '';
    this.unlinkingCardId = card.id;

    this.cardsService.unlinkCard(userId, card.id).subscribe({
      next: (response) => {
        this.unlinkingCardId = '';
        this.pageMessage = response.message;

        const selected = this.cardContext.getSelectedCard();
        if (selected?.id === card.id) {
          this.cardContext.selectCard(null);
        }

        this.loadData();
      },
      error: (err: { error?: { error?: string } }) => {
        this.unlinkingCardId = '';
        this.pageError = err?.error?.error ?? 'Unable to unlink this card.';
      },
    });
  }

  private loadData(): void {
    const userId = this.auth.userId;
    if (!userId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.pageError = '';

    this.cardsService.getWallet(userId).subscribe({
      next: (wallet) => {
        this.cards = [...wallet.prepaid, ...wallet.cashcard, ...wallet.others];
        this.cardsService.getReceiveSettings(userId).subscribe({
          next: (settings) => {
            this.receiveSettings = settings;
            this.isLoading = false;
          },
          error: () => {
            this.receiveSettings = null;
            this.isLoading = false;
          },
        });
      },
      error: () => {
        this.isLoading = false;
        this.pageError = 'Could not load your cards. Make sure the backend is running.';
      },
    });
  }
}
