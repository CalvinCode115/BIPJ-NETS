import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CardsService, TopUpResponse, WalletCard } from '../../../services/cards.service';
import {
  buildTopUpFundingOptions,
  MAX_TOP_UP_AMOUNT,
  MAX_WALLET_BALANCE,
  MIN_TOP_UP_AMOUNT,
  SOURCE_CARD_RESERVE,
  TopUpFundingOption,
} from '../../../utils/wallet-topup';
import { CardsByTypeMap } from './home-activity.service';

export type TopUpPrepareResult =
  | { ok: false; error: string }
  | { ok: true; cardId: string; funding: TopUpFundingOption };

@Injectable({
  providedIn: 'root',
})
export class HomeTopUpService {
  constructor(private cardsService: CardsService) {}

  buildFundingOptions(cardsByType: CardsByTypeMap): TopUpFundingOption[] {
    return buildTopUpFundingOptions(cardsByType);
  }

  /**
   * Validate amount + funding before calling the API.
   * Returns an error string or the resolved cardId + funding option.
   */
  prepareTopUp(input: {
    userId: string | null;
    card: WalletCard | null;
    cardsByType: CardsByTypeMap;
    amount: number;
    selectedFundingId: string;
    fundingOptions: TopUpFundingOption[];
    resolveCardId: (card: WalletCard) => string | undefined;
  }): TopUpPrepareResult {
    const { userId, card, cardsByType, amount, selectedFundingId, fundingOptions, resolveCardId } =
      input;

    if (!card || !userId) {
      return { ok: false, error: 'Please log in and select a card to top up.' };
    }

    if (!Number.isInteger(amount)) {
      return { ok: false, error: 'Enter a whole-dollar amount.' };
    }

    if (amount < MIN_TOP_UP_AMOUNT) {
      return { ok: false, error: `Minimum top-up is $${MIN_TOP_UP_AMOUNT}.` };
    }

    if (amount > MAX_TOP_UP_AMOUNT) {
      return { ok: false, error: `Maximum top-up is $${MAX_TOP_UP_AMOUNT}.` };
    }

    if (card.balance + amount > MAX_WALLET_BALANCE) {
      return {
        ok: false,
        error: `This top-up would exceed the $${MAX_WALLET_BALANCE.toLocaleString('en-SG')} wallet limit.`,
      };
    }

    const cardId = resolveCardId(card);
    if (!cardId) {
      return {
        ok: false,
        error: 'Unable to identify this card. Refresh the page and try again.',
      };
    }

    const funding =
      fundingOptions.find((option) => option.id === selectedFundingId) ?? fundingOptions[0];

    if (!funding) {
      return { ok: false, error: 'Select a payment method.' };
    }

    if (funding.sourceCardId) {
      const sourceCard = cardsByType.others.find((item) => item.id === funding.sourceCardId);
      if (!sourceCard || sourceCard.balance - amount < SOURCE_CARD_RESERVE) {
        return {
          ok: false,
          error: `Keep at least $${SOURCE_CARD_RESERVE} available on the selected bank card.`,
        };
      }
    }

    return { ok: true, cardId, funding };
  }

  submitTopUp(
    userId: string,
    cardId: string,
    amount: number,
    funding: TopUpFundingOption
  ): Observable<TopUpResponse> {
    return this.cardsService.topUpCard(userId, cardId, {
      amount,
      method: funding.method,
      sourceCardId: funding.sourceCardId,
    });
  }
}
