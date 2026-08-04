import {
  WalletCard,
  formatCardFundsLabel,
  formatCardPaymentLabel,
  getCardFundsAmount,
} from '../services/cards.service';
import { maskCardNumber, maskCardPaymentLabel } from './display-name';

export function displayedCardBalance(
  card: WalletCard | null, 
  showSensitive: boolean,
  currency: 'SGD'| 'MYR' = 'SGD',
  fxRate: number = 1
): string {
  if (!card) {
    return '';
  }
  if (!showSensitive) {
    return currency === 'SGD' ? '$**.**' : '**.**';
  }

  const amount = getCardFundsAmount(card) * fxRate;
    if (currency === 'MYR') {
    return `RM ${amount.toFixed(2)}`;
  }
  // else default SGD
  return `$${amount.toFixed(2)}`;
}

export function displayedCardNumber(card: WalletCard | null, showSensitive: boolean): string {
  if (!card) {
    return '';
  }
  if (showSensitive) {
    return card.cardNumber;
  }
  return maskCardNumber(card.cardNumber);
}

export function displayedCardPaymentLabel(card: WalletCard | null, showSensitive: boolean): string {
  if (!card) {
    return '';
  }
  const label = formatCardPaymentLabel(card);
  if (showSensitive) {
    return label;
  }
  return maskCardPaymentLabel(label);
}

export function displayedCardFundsLabel(card: WalletCard | null, showSensitive: boolean): string {
  if (!card || !showSensitive) {
    return '$**.**';
  }
  return formatCardFundsLabel(card);
}

export function displayedCardExpiry(expiry: string | undefined, showSensitive: boolean): string {
  if (!expiry) {
    return '';
  }
  if (showSensitive) {
    return expiry;
  }
  return '**/**';
}
