import { Injectable } from '@angular/core';
import { Observable, map, of, catchError } from 'rxjs';
import {
  CardsByType,
  CardsService,
  MultiCurrencyWallet,
  WalletCard,
  getCardFundsAmount,
} from '../../../services/cards.service';
import {
  CardLinkedExchangeService,
  CardCurrencyBalance,
} from '../../../services/card-linked-exchange.service';
import { clearLowBalanceDismiss } from '../../../utils/notification-preferences';
import { LOW_BALANCE_THRESHOLD } from '../../../utils/wallet-topup';
import {
  currentSgdBalanceStorageKey,
  selectedCardStorageKey,
} from '../../../utils/card-storage';

export const EMPTY_CARDS_BY_TYPE: CardsByType = {
  prepaid: [],
  cashcard: [],
  others: [],
};

@Injectable({
  providedIn: 'root',
})
export class HomeWalletService {
  constructor(
    private cardsService: CardsService,
    private cardExchange: CardLinkedExchangeService,
  ) {}

  loadWallet(userId: string): Observable<CardsByType> {
    return this.cardsService.getWallet(userId);
  }

  persistWalletSgdSnapshot(userId: string, wallet: CardsByType): void {
    const allCards = [...wallet.prepaid, ...wallet.cashcard, ...wallet.others];
    const selectedCardId = localStorage.getItem(selectedCardStorageKey(userId));
    const selectedCard =
      allCards.find((c) => c.id === selectedCardId) || allCards[0];
    if (selectedCard) {
      localStorage.setItem(
        currentSgdBalanceStorageKey(userId),
        String(getCardFundsAmount(selectedCard)), // ← was selectedCard.balance
      );
    }
  }

  persistCurrentCardSelection(
    userId: string,
    card: WalletCard,
    fundsAmount: number,
  ): void {
    localStorage.setItem(selectedCardStorageKey(userId), card.id || 'default');
    localStorage.setItem(
      currentSgdBalanceStorageKey(userId),
      String(fundsAmount),
    );
  }

  replaceCardInWallet(
    cardsByType: CardsByType,
    updatedCard: WalletCard,
  ): CardsByType {
    const type = updatedCard.cardType;
    return {
      ...cardsByType,
      [type]: cardsByType[type].map((card) =>
        card.id === updatedCard.id ? { ...updatedCard } : card,
      ),
    };
  }

  clearLowBalanceDismissIfRecovered(
    userId: string | null,
    card: WalletCard,
  ): void {
    if (!userId || !card.id) {
      return;
    }
    if (getCardFundsAmount(card) >= LOW_BALANCE_THRESHOLD) {
      clearLowBalanceDismiss(userId, card.id);
    }
  }

  loadCurrencyBalances(
    userId: string,
    cardId: string,
    _sgdAmount: number,
  ): Observable<CardCurrencyBalance[]> {
    // REMOVE: localStorage.setItem(currentSgdBalanceStorageKey(userId), String(sgdAmount));

    return this.cardsService.getCardWallet(userId, cardId).pipe(
      map((wallet: MultiCurrencyWallet) => {
        // Write REAL SGD from the actual wallet response
        const realSgd = wallet.balances['SGD'] ?? 0;
        localStorage.setItem(
          currentSgdBalanceStorageKey(userId),
          String(realSgd),
        );

        return Object.entries(wallet.balances).map(([currency, amount]) => ({
          currency,
          amount,
          flag: this.cardExchange.getCurrencyFlag(currency),
        }));
      }),
      catchError(() => of([])),
    );
  }

  formatMultiCurrencyAmount(curr: CardCurrencyBalance): string {
    return (
      this.cardExchange.getCurrencySymbol(curr.currency) +
      this.cardExchange.formatAmount(curr.amount, curr.currency)
    );
  }
}
