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

export const FALLBACK_REGISTRY: RegistryCard[] = [
  buildRegistryCard('prepaid', 'NETS Prepaid', '5990 8990 6778 6689', 125.5),
  buildRegistryCard('prepaid', 'NETS Prepaid (Student)', '6011 0000 0000 0004', 42),
  buildRegistryCard('prepaid', 'NETS Prepaid (Travel)', '6011 0000 0000 0005', 380.75),
  buildRegistryCard('prepaid', 'NETS Prepaid (Premium)', '6011 0000 0000 0006', 485),
  buildRegistryCard('prepaid', 'NETS Prepaid (Starter)', '6011 0000 0000 0007', 15),
  buildRegistryCard('prepaid', 'NETS Prepaid', '6011 0000 0000 0008', 55),
  buildRegistryCard('prepaid', 'NETS Prepaid', '6011 0000 0000 0009', 210),
  buildRegistryCard('prepaid', 'NETS Prepaid', '6011 0000 0000 0010', 920),
  buildRegistryCard('prepaid', 'NETS Prepaid', '6011 0000 0000 0011', 175.25),
  buildRegistryCard('prepaid', 'NETS Prepaid', '6011 0000 0000 0012', 8.5),
  buildRegistryCard('cashcard', 'NETS CashCard (Transit)', '6250 1234 5678 9012', 28.9),
  buildRegistryCard('cashcard', 'NETS CashCard (Motoring)', '6250 9876 5432 1098', 67.3),
  buildRegistryCard('cashcard', 'NETS CashCard (FlashPay)', '6250 1111 2222 3333', 0),
  buildRegistryCard('cashcard', 'NETS CashCard (Family)', '6250 4455 6677 8899', 203.15),
  buildRegistryCard('cashcard', 'NETS CashCard', '5283 7788 7892 1289', 112.5),
  buildRegistryCard('cashcard', 'NETS CashCard', '6250 5556 6677 7888', 45),
  buildRegistryCard('cashcard', 'NETS CashCard', '6250 6667 7788 8999', 18.6),
  buildRegistryCard('cashcard', 'NETS CashCard', '6250 7778 8899 9000', 92.4),
  buildRegistryCard('cashcard', 'NETS CashCard', '6250 8889 9900 0111', 134.75),
  buildRegistryCard('cashcard', 'NETS CashCard', '6250 9990 0011 1222', 56.2),
  buildRegistryCard('others', 'Linked Visa Debit', '4111 1111 1111 1111', 0, 'ADAM LIM'),
  buildRegistryCard('others', 'Linked Mastercard Credit', '5500 0000 0000 0004', 156.4, 'BELINDA HO', 3000),
  buildRegistryCard('others', 'Linked DBS Debit', '4532 0151 1283 0366', 245.8, 'ALEX TAN'),
  buildRegistryCard('others', 'Linked OCBC Credit', '4917 6100 0000 0000', 2450, 'SARAH LIM', 3000),
  buildRegistryCard('others', 'Linked UOB Debit', '5213 2400 0000 0000', 312, 'JUN JIE GOH'),
  buildRegistryCard('others', 'Linked POSB Debit', '4532 1234 5678 9012', 188.2, 'MEI LING TAN'),
  buildRegistryCard('others', 'Linked Maybank Debit', '4532 9876 5432 1098', 421.5, 'RAJ KUMAR'),
  buildRegistryCard('others', 'Linked HSBC Debit', '4111 2222 3333 4444', 76.9, 'JASON ONG'),
  buildRegistryCard('others', 'Linked Citi Debit', '5213 5678 9012 3456', 502.3, 'NURUL AZIZ'),
  buildRegistryCard('others', 'Linked UOB Debit (Premium)', '5213 7890 1234 5678', 890, 'DAVID CHUA'),
  buildRegistryCard('others', 'Linked DBS Credit', '5500 1234 5678 9012', 680, 'EMILY KOH', 3000),
  buildRegistryCard('others', 'Linked OCBC Credit (Platinum)', '4917 1234 5678 9012', 420, 'MICHAEL GOH', 3000),
  buildRegistryCard('others', 'Linked UOB Credit', '5500 9876 5432 1098', 920, 'PRIYA NAIR', 3000),
  buildRegistryCard('others', 'Linked Maybank Credit', '4532 1111 2222 3333', 1100, 'WEI MING LEE', 3000),
  buildRegistryCard('others', 'Linked Citi Credit', '5500 4455 6677 8899', 750, 'SITI AMINAH', 3000),
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
