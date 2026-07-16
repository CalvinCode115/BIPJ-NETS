import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';

export type CardType = 'prepaid' | 'cashcard' | 'others';
export type AccountKind = 'debit' | 'credit';

export interface WalletCard {
  id: string;
  cardType: CardType;
  label: string;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  maskedNumber?: string;
  balance: number;
  topUpEnabled: boolean;
  bankName?: string | null;
  accountKind?: AccountKind | null;
  isDefaultReceive?: boolean;
  creditLimit?: number | null;
}

export interface CardsByType {
  prepaid: WalletCard[];
  cashcard: WalletCard[];
  others: WalletCard[];
}

export interface LinkCardRequest {
  cardType: CardType;
  cardNumber: string;
  cardholderName?: string;
  expiryDate: string;
  cvv: string;
  bankName?: string;
  accountKind?: AccountKind;
  isDefaultReceive?: boolean;
}

export interface LinkCardResponse {
  success: boolean;
  source: 'nets_registry' | 'nets_simulated';
  message: string;
  card: WalletCard;
}

export interface RegistryCard {
  cardType: CardType;
  label: string;
  cardNumber: string;
  balance: number;
  expiryDate: string;
  cvv: string;
  cardholderName: string | null;
  requiresCardholder: boolean;
  bankName?: string;
  accountKind?: AccountKind;
  creditLimit?: number;
}

const EMPTY_WALLET: CardsByType = {
  prepaid: [],
  cashcard: [],
  others: [],
};

function buildRegistryCard(
  cardType: CardType,
  label: string,
  cardNumber: string,
  balance: number,
  cardholderName: string | null = null,
  creditLimit?: number
): RegistryCard {
  const inferred = cardType === 'others' ? inferRegistryMeta(label) : {};
  return {
    cardType,
    label,
    cardNumber,
    balance,
    expiryDate: '07/28',
    cvv: '123',
    cardholderName,
    requiresCardholder: cardType === 'others',
    bankName: inferred.bankName,
    accountKind: inferred.accountKind,
    creditLimit,
  };
}

/** Banks available when linking a debit/credit card — keep in sync with registry + backend card-utils. */
export const LINKABLE_BANKS = [
  'DBS',
  'POSB',
  'UOB',
  'OCBC',
  'Maybank',
  'HSBC',
  'Citi',
  'Visa',
  'Mastercard',
] as const;

export type LinkableBank = (typeof LINKABLE_BANKS)[number];

const BANK_DISPLAY_NAMES: Record<string, string> = {
  dbs: 'DBS',
  posb: 'POSB',
  uob: 'UOB',
  ocbc: 'OCBC',
  maybank: 'Maybank',
  hsbc: 'HSBC',
  citi: 'Citi',
  visa: 'Visa',
  mastercard: 'Mastercard',
};

function inferRegistryMeta(label: string): { bankName?: string; accountKind?: AccountKind } {
  const text = label.toLowerCase();
  const accountKind: AccountKind = text.includes('credit') ? 'credit' : 'debit';
  const hit = Object.keys(BANK_DISPLAY_NAMES).find((bank) => text.includes(bank));
  return {
    bankName: hit ? BANK_DISPLAY_NAMES[hit] : 'Bank',
    accountKind,
  };
}

export type TopUpMethod = 'bank' | 'card' | 'paynow' | 'linked';

export interface TopUpRequest {
  amount: number;
  method: TopUpMethod;
  sourceCardId?: string;
}

export interface TopUpResponse {
  success: boolean;
  message: string;
  card: WalletCard;
  sourceCard?: WalletCard;
}

export interface MultiCurrencyWallet {
  cardId: string;
  balances: Record<string, number>;
  currencies: string[];
}

export interface ExchangeCurrencyRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  rate: number;
}

export interface DeductCurrencyRequest {
  currency: string;
  amount: number;
}

export interface ExchangeCurrencyResponse {
  success: boolean;
  message: string;
  newBalances: Record<string, number>;
  card: WalletCard;
}

@Injectable({
  providedIn: 'root',
})
export class CardsService {
  constructor(private http: HttpClient) {}

  getWallet(userId: string): Observable<CardsByType> {
    return this.http.get<{ cardsByType: CardsByType }>(`${API_BASE_URL}/users/${userId}/cards/wallet`).pipe(
      map((response) => response.cardsByType)
    );
  }

  linkCard(userId: string, payload: LinkCardRequest): Observable<LinkCardResponse> {
    return this.http.post<LinkCardResponse>(`${API_BASE_URL}/users/${userId}/cards/link`, payload);
  }

  getPayableCards(userId: string): Observable<WalletCard[]> {
    return this.http
      .get<{ cards: WalletCard[] }>(`${API_BASE_URL}/users/${userId}/payable-cards`)
      .pipe(
        map((response) => response.cards),
        catchError(() => of([]))
      );
  }

  topUpCard(userId: string, cardId: string, payload: TopUpRequest): Observable<TopUpResponse> {
    return this.http.post<TopUpResponse>(
      `${API_BASE_URL}/users/${userId}/cards/${cardId}/top-up`,
      payload
    );
  }

  getRegistry(): Observable<RegistryCard[]> {
    return this.http
      .get<{ cards: Partial<RegistryCard>[] }>(`${API_BASE_URL}/nets-simulator/registry`)
      .pipe(
        map((response) => response.cards.map((card) => normalizeRegistryCard(card))),
        catchError(() => of(FALLBACK_REGISTRY))
      );
  }

  unlinkCard(userId: string, cardId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${API_BASE_URL}/users/${userId}/cards/${cardId}`
    );
  }

  setDefaultReceive(
    userId: string,
    cardId: string
  ): Observable<{ success: boolean; message: string; card: WalletCard }> {
    return this.http.patch<{ success: boolean; message: string; card: WalletCard }>(
      `${API_BASE_URL}/users/${userId}/cards/${cardId}/default-receive`,
      {}
    );
  }

  setTopUpPreference(
    userId: string,
    cardId: string,
    enabled: boolean
  ): Observable<{ success: boolean; message: string; card: WalletCard }> {
    return this.http.patch<{ success: boolean; message: string; card: WalletCard }>(
      `${API_BASE_URL}/users/${userId}/cards/${cardId}/top-up-preference`,
      { enabled }
    );
  }

  getReceiveSettings(userId: string): Observable<ReceiveSettings> {
    return this.http.get<ReceiveSettings>(`${API_BASE_URL}/users/${userId}/receive-settings`);
  }

  getCardWallet(userId: string, cardId: string): Observable<MultiCurrencyWallet> {
  return this.http.get<MultiCurrencyWallet>(
    `${API_BASE_URL}/users/${userId}/cards/${cardId}/wallet`
  ).pipe(
    catchError(err => {
      console.error('Wallet load failed:', err);
      return of({ cardId, balances: { SGD: 500 }, currencies: ['SGD'] });
    })
  );
}

exchangeCurrency(
  userId: string,
  cardId: string,
  payload: ExchangeCurrencyRequest
): Observable<ExchangeCurrencyResponse> {
  return this.http.post<ExchangeCurrencyResponse>(
    `${API_BASE_URL}/users/${userId}/cards/${cardId}/exchange`,
    payload
  ).pipe(
    catchError(err => {
      console.error('Exchange failed:', err);
      return of({
        success: false,
        message: err.error?.error || 'Exchange failed. Please try again.',
        newBalances: {},
        card: {} as WalletCard
      });
    })
  );
}

deductCurrency(
  userId: string,
  cardId: string,
  payload: DeductCurrencyRequest
): Observable<ExchangeCurrencyResponse> {
  return this.http.post<ExchangeCurrencyResponse>(
    `${API_BASE_URL}/users/${userId}/cards/${cardId}/deduct`,
    payload
  ).pipe(
    catchError(err => {
      console.error('Deduct failed:', err);
      return of({
        success: false,
        message: err.error?.error || 'Payment failed. Please try again.',
        newBalances: {},
        card: {} as WalletCard
      });
    })
  );
}
}

export interface ReceiveSettings {
  defaultCardId: string | null;
  receiveMode: string | null;
  receiveLabel: string | null;
  receiveLabelShort: string | null;
  eligibleCards: WalletCard[];
  fallbackPrepaid: WalletCard | null;
}

export function formatCardPaymentLabel(card: WalletCard): string {
  if (card.cardType === 'others' && card.bankName) {
    const kind = card.accountKind === 'credit' ? 'Credit' : 'Debit';
    return `${card.bankName} ${kind} · ${card.maskedNumber || card.cardNumber}`;
  }
  return `${card.label} · ${card.maskedNumber || card.cardNumber}`;
}

export function formatCardFundsLabel(card: WalletCard): string {
  if (card.cardType === 'others' && card.accountKind === 'credit') {
    return `$${card.balance.toFixed(2)} available`;
  }
  return `$${card.balance.toFixed(2)}`;
}

export function getCardThemeClass(card: WalletCard | null | undefined): string {
  if (!card) {
    return '';
  }
  if (card.cardType === 'prepaid') {
    return 'prepaid-theme';
  }
  if (card.cardType === 'cashcard') {
    return 'cashcard-theme';
  }
  if (card.accountKind === 'credit') {
    return 'credit-theme';
  }
  return 'debit-theme';
}

export function getCardBrandBadge(card: WalletCard | null | undefined): string {
  if (!card) {
    return '';
  }
  if (card.cardType === 'others' && card.bankName) {
    const kind = card.accountKind === 'credit' ? 'CREDIT' : 'DEBIT';
    return `${card.bankName.toUpperCase()} ${kind}`;
  }
  if (card.cardType === 'prepaid') {
    return 'NETS PREPAID';
  }
  if (card.cardType === 'cashcard') {
    return 'NETS CASHCARD';
  }
  return card.label.toUpperCase();
}

export function getCardFundsLabel(card: WalletCard | null | undefined): string {
  if (!card) {
    return 'CURRENT BALANCE';
  }
  if (card.cardType === 'others' && card.accountKind === 'credit') {
    return 'AVAILABLE CREDIT';
  }
  return 'CURRENT BALANCE';
}

export function getCardFundsAmount(card: WalletCard | null | undefined): number {
  if (!card) {
    return 0;
  }
  return card.balance;
}

export function getCardFundsSubtext(card: WalletCard | null | undefined): string | null {
  if (!card || card.cardType !== 'others' || card.accountKind !== 'credit') {
    return null;
  }
  const limit = Math.min(card.creditLimit ?? 3000, 3000);
  return `$${limit.toFixed(2)} credit limit`;
}

/** Prepaid + linked bank cards can pay/QR; CashCard is transit-only. */
export function isPayableCard(card: WalletCard | null | undefined): boolean {
  return Boolean(card && card.cardType !== 'cashcard');
}

/** Prefer Prepaid, then linked cards — never auto-pick CashCard for Pay/QR. */
export function firstPayableCard(wallet: CardsByType): WalletCard | null {
  return wallet.prepaid[0] ?? wallet.others[0] ?? null;
}

/**
 * Resolve which card Pay/QR should use:
 * 1. Keep Home selection if it is payable
 * 2. Otherwise first payable card in wallet
 * 3. Only then CashCard (so Pay can still show the transit notice)
 */
export function resolveActivePayCard(
  selected: WalletCard | null,
  wallet: CardsByType,
  findInWallet: (card: WalletCard | null, wallet: CardsByType) => WalletCard | null
): WalletCard | null {
  const refreshed = findInWallet(selected, wallet);
  if (isPayableCard(refreshed)) {
    return refreshed;
  }

  const payable = firstPayableCard(wallet);
  if (payable) {
    return payable;
  }

  return refreshed ?? wallet.cashcard[0] ?? null;
}

export const FALLBACK_REGISTRY: RegistryCard[] = [
  buildRegistryCard('prepaid', 'NETS Prepaid', '5990 8990 6778 6689', 125.5),
  buildRegistryCard('cashcard', 'NETS CashCard (Transit)', '6250 1234 5678 9012', 28.9),
  buildRegistryCard('others', 'Linked DBS Debit', '4532 0151 1283 0366', 245.8, 'ALEX TAN'),
  buildRegistryCard('others', 'Linked Mastercard Credit', '5500 0000 0000 0004', 156.4, 'BELINDA HO', 3000),
];

function normalizeRegistryCard(card: Partial<RegistryCard>): RegistryCard {
  const cardNumber = card.cardNumber ?? '';
  const fallback = FALLBACK_REGISTRY.find(
    (entry) => entry.cardNumber.replace(/\D/g, '') === cardNumber.replace(/\D/g, '')
  );
  const cardType = card.cardType ?? fallback?.cardType ?? 'prepaid';

  return {
    cardType,
    label: card.label ?? fallback?.label ?? 'Demo card',
    cardNumber: cardNumber || fallback?.cardNumber || '',
    balance: card.balance ?? fallback?.balance ?? 0,
    expiryDate: card.expiryDate || fallback?.expiryDate || '07/28',
    cvv: card.cvv || fallback?.cvv || '123',
    cardholderName: card.cardholderName ?? fallback?.cardholderName ?? null,
    requiresCardholder: card.requiresCardholder ?? cardType === 'others',
    bankName: card.bankName ?? fallback?.bankName,
    accountKind: (card.accountKind ?? fallback?.accountKind) as AccountKind | undefined,
    creditLimit: card.creditLimit ?? fallback?.creditLimit,
  };
}


