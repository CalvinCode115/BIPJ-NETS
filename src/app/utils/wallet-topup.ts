import {
  CardsByType,
  formatCardPaymentLabel,
  TopUpMethod,
  WalletCard,
  getCardFundsAmount,
} from '../services/cards.service';

/** Match backend `wallet-config.js`. */
export const LOW_BALANCE_THRESHOLD = 50;
export const MIN_TOP_UP_AMOUNT = 1;
export const MAX_TOP_UP_AMOUNT = 500;
export const MAX_WALLET_BALANCE = 5000;
export const SOURCE_CARD_RESERVE = 50;

export interface TopUpFundingOption {
  id: string;
  method: TopUpMethod;
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  sourceCardId?: string;
}

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

export function buildTopUpFundingOptions(cardsByType: CardsByType): TopUpFundingOption[] {
  const debits = cardsByType.others.filter((card) => card.accountKind !== 'credit');
  const credits = cardsByType.others.filter((card) => card.accountKind === 'credit');

  const options: TopUpFundingOption[] = [
    ...debits.map((card) => ({
      id: `linked_${card.id}`,
      method: 'linked' as TopUpMethod,
      title: formatCardPaymentLabel(card),
      subtitle: `$${card.balance.toFixed(2)} available`,
      icon: 'business',
      iconColor: '#2f80ed',
      iconBg: '#e3f2fd',
      sourceCardId: card.id,
    })),
    ...credits.map((card) => ({
      id: `linked_${card.id}`,
      method: 'linked' as TopUpMethod,
      title: formatCardPaymentLabel(card),
      subtitle: `$${card.balance.toFixed(2)} available credit`,
      icon: 'business',
      iconColor: '#c5cae9',
      iconBg: '#1e3a5f',
      sourceCardId: card.id,
    })),
  ];

  options.push({
    id: 'paynow',
    method: 'paynow',
    title: 'PayNow',
    subtitle: 'External bank account',
    icon: 'phone-portrait',
    iconColor: '#27ae60',
    iconBg: '#e8f8ef',
  });

  return options;
}

/** @deprecated use canManualTopUpWalletCard */
export const canTopUpWalletCard = canManualTopUpWalletCard;

/** @deprecated use manualTopUpDisabledReason */
export function topUpDisabledReason(card: WalletCard | null | undefined): string {
  return manualTopUpDisabledReason(card);
}
