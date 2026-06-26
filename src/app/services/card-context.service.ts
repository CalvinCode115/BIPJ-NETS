import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WalletCard } from './cards.service';

@Injectable({
  providedIn: 'root',
})
export class CardContextService {
  private readonly selectedCardSubject = new BehaviorSubject<WalletCard | null>(null);
  private readonly showSensitiveDetailsSubject = new BehaviorSubject(false);

  readonly selectedCard$ = this.selectedCardSubject.asObservable();
  readonly showSensitiveDetails$ = this.showSensitiveDetailsSubject.asObservable();

  selectCard(card: WalletCard | null): void {
    this.selectedCardSubject.next(card);
  }

  getSelectedCard(): WalletCard | null {
    return this.selectedCardSubject.value;
  }

  getSelectedCardId(): string | undefined {
    return this.selectedCardSubject.value?.id;
  }

  getShowSensitiveDetails(): boolean {
    return this.showSensitiveDetailsSubject.value;
  }

  toggleSensitiveDetails(): void {
    this.showSensitiveDetailsSubject.next(!this.showSensitiveDetailsSubject.value);
  }

  setShowSensitiveDetails(show: boolean): void {
    this.showSensitiveDetailsSubject.next(show);
  }

  getSelectedCardFilters(): { cardId?: string; cardNumber?: string } {
    const card = this.getSelectedCard();
    if (!card) {
      return {};
    }

    return {
      cardId: card.id,
      cardNumber: card.cardNumber,
    };
  }
}
