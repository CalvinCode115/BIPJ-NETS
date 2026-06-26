import { WalletCard, getCardFundsAmount } from '../services/cards.service';

/** Match backend `wallet-config.js`. */
export const LOW_BALANCE_THRESHOLD = 50;

/** Prepaid / CashCard can always be topped up manually from the Top Up flow. */
export function canManualTopUpWalletCard(card: WalletCard | null | undefined): boolean {
  return Boolean(card && (card.cardType === 'prepaid' || card.cardType === 'cashcard'));
}

/** Auto top-up toggle is on when balance drops below the threshold (synced by backend). */
export function isAutoTopUpEnabled(card: WalletCard | null | undefined): boolean {
  if (!canManualTopUpWalletCard(card)) {
    return false;
  }
  return getCardFundsAmount(card) < LOW_BALANCE_THRESHOLD;
}

export function manualTopUpDisabledReason(card: WalletCard | null | undefined): string {
  if (!card) {
    return 'Add a card to top up.';
  }
  if (card.cardType === 'others') {
    return 'Linked bank cards are funded from your bank account and cannot be topped up here.';
  }
  if (!canManualTopUpWalletCard(card)) {
    return 'This card cannot be topped up here.';
  }
  return '';
}

/** @deprecated use canManualTopUpWalletCard */
export const canTopUpWalletCard = canManualTopUpWalletCard;

/** @deprecated use manualTopUpDisabledReason */
export function topUpDisabledReason(card: WalletCard | null | undefined): string {
  return manualTopUpDisabledReason(card);
}
