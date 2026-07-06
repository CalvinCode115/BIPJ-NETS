import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { CardType, WalletCard } from './cards.service';
import { ReceiptScanResult } from './receipts.service';

export interface PeriodOption {
  month: number;
  year: number;
  label: string;
}

export interface TransferCounterparty {
  direction: 'from' | 'to';
  phone?: string;
  name?: string;
}

export interface TransactionRecord {
  id: string;
  merchant: string;
  subtitle: string;
  amount: number;
  date: string;
  time: string;
  icon: string;
  iconColor: string;
  type: 'debit' | 'credit';
  category: string;
  cardId?: string;
  counterparty?: TransferCounterparty | null;
}

export interface TransactionSummary {
  month: string;
  monthLabel: string;
  totalSpending: number;
  transactionCount: number;
  avgPerDay: number;
}

export interface TransactionsResponse {
  transactions: TransactionRecord[];
  summary: TransactionSummary;
  availablePeriods: PeriodOption[];
  selectedPeriod: PeriodOption;
}

export interface DashboardResponse {
  monthlySummary: {
    month: string;
    totalIn: number;
    totalInChange: number;
    totalSpent: number;
    totalSpentChange: number;
  };
  spendingCategories: Array<{ label: string; amount: number; color: string }>;
  insight: { title: string; message: string };
  recentTransactions: TransactionRecord[];
  selectedPeriod: PeriodOption;
}

export interface ReportResponse {
  reportPeriod: string;
  selectedPeriod: PeriodOption;
  availablePeriods: PeriodOption[];
  stats: Array<{ label: string; value: string; badge: string; badgeType: string }>;
  trendMonths: Array<{ label: string; spending: number; income: number }>;
  categories: Array<{ name: string; amount: number; change: number; color: string; percent: number }>;
  netSaved: number;
  savingsGoalProgress: number;
  compareLabel: string;
}

export interface InsightsResponse {
  summaryMonth: string;
  selectedPeriod: PeriodOption;
  availablePeriods: PeriodOption[];
  summaryStats: Array<{ label: string; value: string }>;
  topSpots: Array<{ rank: number; name: string; amount: number; category: string; visits: number }>;
  transportAnalysis: { totalTransport: number; totalTrips: number; highlight: string };
  smartInsights: Array<{ title: string; message: string; icon: string; color: string; bg: string }>;
  traits?: string[];
  deepDives?: Array<{
    id: string;
    heading: string;
    subtitle: string;
    icon: string;
    iconColor: string;
    iconBg: string;
    total: number;
    segments: Array<{ label: string; amount: number; percent: number; color: string }>;
  }>;
  foodDonut?: { title: string; total: number; segments: Array<{ label: string; amount: number; color: string }> };
  shoppingDonut?: { title: string; total: number; segments: Array<{ label: string; amount: number; color: string }> };
}

@Injectable({
  providedIn: 'root',
})
export class TransactionsService {
  readonly currentMonth = 6;
  readonly currentYear = 2026;

  constructor(private http: HttpClient) {}

  getTransactions(
    userId: string,
    filters: {
      month?: number;
      year?: number;
      search?: string;
      type?: string;
      category?: string;
      cardId?: string;
      cardNumber?: string;
      cardType?: CardType;
    } = {}
  ): Observable<TransactionsResponse> {
    let params = new HttpParams()
      .set('month', String(filters.month ?? this.currentMonth))
      .set('year', String(filters.year ?? this.currentYear));

    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.type && filters.type !== 'all') {
      params = params.set('type', filters.type);
    }
    if (filters.category && filters.category !== 'All') {
      params = params.set('category', filters.category);
    }
    if (filters.cardId) {
      params = params.set('cardId', filters.cardId);
    } else if (filters.cardNumber) {
      params = params.set('cardNumber', filters.cardNumber.replace(/\D/g, ''));
    } else if (filters.cardType) {
      params = params.set('cardType', filters.cardType);
    }

    const scoped = Boolean(filters.cardId || filters.cardNumber || filters.cardType);

    return this.http
      .get<TransactionsResponse>(`${API_BASE_URL}/users/${userId}/transactions`, { params })
      .pipe(map((response) => this.mergeTransactions(userId, response, filters, scoped)));
  }

  getDashboard(
    userId: string,
    options: {
      month?: number;
      year?: number;
      cardId?: string;
      cardNumber?: string;
      cardType?: CardType;
      period?: 'monthly' | 'weekly';
    } = {}
  ): Observable<DashboardResponse> {
    let params = new HttpParams()
      .set('month', String(options.month ?? this.currentMonth))
      .set('year', String(options.year ?? this.currentYear))
      .set('period', options.period ?? 'monthly');

    if (options.cardId) {
      params = params.set('cardId', options.cardId);
    } else if (options.cardNumber) {
      params = params.set('cardNumber', options.cardNumber.replace(/\D/g, ''));
    } else if (options.cardType) {
      params = params.set('cardType', options.cardType);
    }

    const scoped = Boolean(options.cardId || options.cardNumber || options.cardType);

    return this.http
      .get<DashboardResponse>(`${API_BASE_URL}/users/${userId}/dashboard`, { params })
      .pipe(map((response) => this.mergeDashboard(userId, response, options, scoped)));
  }

  getReport(
    userId: string,
    month = this.currentMonth,
    year = this.currentYear,
    options: { cardId?: string; cardNumber?: string; cardType?: CardType } = {}
  ): Observable<ReportResponse> {
    let params = new HttpParams().set('month', String(month)).set('year', String(year));

    if (options.cardId) {
      params = params.set('cardId', options.cardId);
    } else if (options.cardNumber) {
      params = params.set('cardNumber', options.cardNumber.replace(/\D/g, ''));
    } else if (options.cardType) {
      params = params.set('cardType', options.cardType);
    }

    return this.http.get<ReportResponse>(`${API_BASE_URL}/users/${userId}/report`, { params });
  }

  getInsights(userId: string, month = this.currentMonth, year = this.currentYear): Observable<InsightsResponse> {
    const params = new HttpParams().set('month', String(month)).set('year', String(year));
    return this.http.get<InsightsResponse>(`${API_BASE_URL}/users/${userId}/insights`, { params });
  }

  saveReceiptTransaction(
    userId: string,
    receipt: ReceiptScanResult
  ): Observable<{ success: boolean; message: string; transaction: TransactionRecord; card?: WalletCard }> {
    return this.http
      .post<{ success: boolean; message: string; transaction: TransactionRecord; card?: WalletCard }>(
        `${API_BASE_URL}/users/${userId}/transactions/receipt`,
        { receipt }
      )
      .pipe(
        catchError((err) => {
          const message =
            err?.error?.error ??
            'Receipt was read but could not be saved. Please try again.';
          return throwError(() => new Error(message));
        })
      );
  }

  private getLocalTransactions(userId: string): TransactionRecord[] {
    const key = `nets_local_txns_${userId}`;
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? '[]') as TransactionRecord[];
    } catch {
      return [];
    }
  }

  private mergeTransactions(
    userId: string,
    response: TransactionsResponse,
    filters: { cardId?: string; cardNumber?: string; cardType?: CardType } = {},
    scoped = false
  ): TransactionsResponse {
    const local = this.filterLocalTransactions(userId, filters, scoped);
    if (!local.length) {
      return response;
    }

    const merged = [...local, ...response.transactions];
    const spending = merged.filter((txn) => txn.amount < 0).reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

    return {
      ...response,
      transactions: merged,
      summary: {
        ...response.summary,
        transactionCount: merged.length,
        totalSpending: round2(spending),
      },
    };
  }

  private mergeDashboard(
    userId: string,
    response: DashboardResponse,
    filters: { cardId?: string; cardNumber?: string; cardType?: CardType } = {},
    scoped = false
  ): DashboardResponse {
    const local = this.filterLocalTransactions(userId, filters, scoped);
    if (!local.length) {
      return response;
    }

    const localSpent = local
      .filter((txn) => txn.amount < 0)
      .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

    return {
      ...response,
      recentTransactions: [...local, ...response.recentTransactions].slice(0, 5),
      monthlySummary: {
        ...response.monthlySummary,
        totalSpent: round2(response.monthlySummary.totalSpent + localSpent),
      },
    };
  }

  private filterLocalTransactions(
    userId: string,
    filters: { cardId?: string; cardNumber?: string; cardType?: CardType },
    scoped = false
  ): TransactionRecord[] {
    const local = this.getLocalTransactions(userId);
    if (!local.length) {
      return [];
    }

    if (filters.cardId) {
      return local.filter((txn) => txn.cardId === filters.cardId);
    }

    if (filters.cardNumber) {
      return [];
    }

    if (filters.cardType) {
      return [];
    }

    return scoped ? [] : local;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const RECEIPT_MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function parseSingaporeReceiptDate(dateStr: string): Date {
  const text = String(dateStr || '').trim().replace(/\s{2,}/g, ' ');
  const match = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = RECEIPT_MONTHS[match[2].toLowerCase().slice(0, 3)];
    const year = parseInt(match[3], 10);
    if (month) {
      const hour = match[4] !== undefined ? parseInt(match[4], 10) : 12;
      const minute = match[5] !== undefined ? parseInt(match[5], 10) : 0;
      const pad = (value: number) => String(value).padStart(2, '0');
      return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return new Date(`${text.slice(0, 19)}+08:00`);
  }

  return new Date();
}

function receiptToTransaction(receipt: ReceiptScanResult): TransactionRecord {
  const iconMap: Record<string, { icon: string; iconColor: string }> = {
    Coffee: { icon: 'cafe', iconColor: '#2f80ed' },
    Drinks: { icon: 'water', iconColor: '#e84393' },
    Dining: { icon: 'restaurant', iconColor: '#eb5757' },
    Groceries: { icon: 'cart', iconColor: '#27ae60' },
    Transport: { icon: 'car', iconColor: '#9b51e0' },
    Retail: { icon: 'shirt', iconColor: '#f2994a' },
  };
  const meta = iconMap[receipt.category] ?? { icon: 'receipt', iconColor: '#6c63ff' };
  const parsed = parseSingaporeReceiptDate(receipt.dateTime || receipt.date);

  return {
    id: `local_txn_${Date.now()}`,
    merchant: receipt.merchant,
    subtitle: 'Receipt scan',
    amount: -Math.abs(receipt.amount),
    date: parsed.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }),
    time: parsed.toLocaleTimeString('en-SG', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Singapore',
    }),
    icon: meta.icon,
    iconColor: meta.iconColor,
    type: 'debit',
    category: receipt.category,
  };
}
