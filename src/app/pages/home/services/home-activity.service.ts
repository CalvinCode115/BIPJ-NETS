import { Injectable } from '@angular/core';
import { Observable, map, of, catchError } from 'rxjs';
import { WalletCard, CardType } from '../../../services/cards.service';
import { TransactionRecord, TransactionsService } from '../../../services/transactions.service';
import { formatTransactionMeta } from '../../../utils/transfer-display';
import { resolveTxnRewardsDisplay } from '../../../utils/txn-rewards-display';

export interface HomeRecentTransaction {
  id?: string;
  merchant: string;
  subtitle: string;
  displayAmount?: string | null;
  amount: number;
  date: string;
  time: string;
  icon: string;
  iconColor: string;
  type: 'debit' | 'credit' | 'exchange';
  category?: string;
  displayPoints?: number;
  displayXp?: number;
  rewardsLimitLabel?: string | null;
}

export interface HomeMonthlySummary {
  month: string;
  totalIn: number;
  totalInChange: number;
  totalSpent: number;
  totalSpentChange: number;
}

export interface HomeSpendingCategory {
  label: string;
  amount: number;
  color: string;
}

export interface HomeCardActivity {
  monthlySummary: HomeMonthlySummary;
  spendingCategories: HomeSpendingCategory[];
  recentTransactions: HomeRecentTransaction[];
}

export interface HomeInsightView {
  title: string;
  message: string;
  style: { icon: string; color: string; bg: string };
  traits: string[];
  error: string;
}

export type CardsByTypeMap = {
  prepaid: WalletCard[];
  cashcard: WalletCard[];
  others: WalletCard[];
};

@Injectable({
  providedIn: 'root',
})
export class HomeActivityService {
  constructor(private transactionsService: TransactionsService) {}

  emptyActivity(): HomeCardActivity {
    return {
      monthlySummary: {
        month: '',
        totalIn: 0,
        totalInChange: 0,
        totalSpent: 0,
        totalSpentChange: 0,
      },
      spendingCategories: [],
      recentTransactions: [],
    };
  }

  buildCardQuery(
    card: WalletCard,
    cardsByType: CardsByTypeMap
  ): { cardId?: string; cardNumber?: string } {
    const cardId = card.id || this.findCardIdByNumber(card.cardNumber, cardsByType);
    return {
      cardId,
      cardNumber: card.cardNumber,
    };
  }

  loadCardActivity(
    userId: string,
    card: WalletCard,
    cardsByType: CardsByTypeMap,
    period: 'monthly' | 'weekly'
  ): Observable<HomeCardActivity | null> {
    const cardQuery = this.buildCardQuery(card, cardsByType);
    if (!cardQuery.cardId && !cardQuery.cardNumber) {
      return of(null);
    }

    return this.transactionsService
      .getDashboard(userId, {
        ...cardQuery,
        period,
      })
      .pipe(
        map((dashboard) => ({
          monthlySummary: dashboard.monthlySummary,
          spendingCategories: dashboard.spendingCategories,
          recentTransactions: dashboard.recentTransactions.map((txn) =>
            this.mapRecentTransaction(txn)
          ),
        }))
      );
  }

  loadOverallInsight(userId: string): Observable<HomeInsightView> {
    return this.transactionsService
      .getInsights(userId, this.transactionsService.currentMonth, this.transactionsService.currentYear)
      .pipe(
        map((response) => {
          const traits = response.traits ?? [];
          const teaser = response.smartInsights[0];
          if (teaser) {
            return {
              title: teaser.title,
              message: teaser.message,
              style: { icon: teaser.icon, color: teaser.color, bg: teaser.bg },
              traits,
              error: '',
            };
          }
          return {
            title: 'Start spending to unlock insights',
            message: 'Pay, top up, or scan receipts — your insights will appear here.',
            style: { icon: 'sparkles', color: '#6c63ff', bg: '#ede7f6' },
            traits,
            error: '',
          };
        }),
        catchError(() => of(this.insightUnavailable()))
      );
  }

  insightUnavailable(): HomeInsightView {
    return {
      title: 'Insights unavailable',
      message: 'Start the backend and refresh to see personalized spending insights.',
      style: { icon: 'warning', color: '#eb5757', bg: '#fdecea' },
      traits: [],
      error: 'Could not load insights.',
    };
  }

  private mapRecentTransaction(txn: TransactionRecord): HomeRecentTransaction {
    const rewards = resolveTxnRewardsDisplay(txn);
    return {
      merchant: txn.merchant,
      subtitle: formatTransactionMeta(txn),
      displayAmount: txn.displayAmount,
      amount: txn.amount,
      date: txn.date,
      time: txn.time,
      icon: txn.icon,
      iconColor: txn.iconColor,
      type: txn.type,
      displayPoints: rewards.points,
      displayXp: rewards.xp,
      rewardsLimitLabel: rewards.limitLabel,
    };
  }

  private findCardIdByNumber(cardNumber: string, cardsByType: CardsByTypeMap): string | undefined {
    const digits = cardNumber.replace(/\D/g, '');
    if (!digits) {
      return undefined;
    }

    for (const type of ['prepaid', 'cashcard', 'others'] as CardType[]) {
      const match = cardsByType[type].find(
        (entry) => entry.cardNumber.replace(/\D/g, '') === digits
      );
      if (match?.id) {
        return match.id;
      }
    }

    return undefined;
  }
}
