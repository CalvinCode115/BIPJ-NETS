import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import {
  CardType,
  WalletCard,
  getCardFundsAmount,
} from '../../../services/cards.service';
import { CardContextService } from '../../../services/card-context.service';
import { AppNotification } from '../../../services/notifications.service';
import {
  HomeActivityService,
  HomeRecentTransaction,
  HomeSpendingCategory,
} from '../services/home-activity.service';
import {
  EMPTY_CARDS_BY_TYPE,
  HomeWalletService,
} from '../services/home-wallet.service';
import { HomeAlertsService } from '../services/home-alerts.service';
import { resolveTxnRewardsDisplay } from '../../../utils/txn-rewards-display';
import {
  formatNotificationAmount,
  formatNotificationSender,
} from '../../../utils/notification-display';
import {
  canManualTopUpWalletCard,
  isAutoTopUpEnabled,
  LOW_BALANCE_THRESHOLD,
  manualTopUpDisabledReason as walletTopUpReason,
} from '../../../utils/wallet-topup';
import { isLowBalanceAlertsEnabled } from '../../../utils/notification-preferences';
import { CardCurrencyBalance } from '../../../services/card-linked-exchange.service';
import { PointsService } from 'src/app/services/points.service';
import { PetBridgeService } from 'src/app/services/pet-bridge.service';
import { PetService } from 'src/app/services/pet.service';
import { HomeCardLinkedEvent } from '../components/home-add-card-modal/home-add-card-modal.component';
import { HomeTopUpCompletedEvent } from '../components/home-top-up-modal/home-top-up-modal.component';
import { HomeQuickAction } from '../components/home-quick-actions/home-quick-actions.component';
import { HomeSecondaryAction } from '../components/home-secondary-actions/home-secondary-actions.component';

interface AccountTab {
  id: CardType;
  label: string;
}

interface CardsByTypeMap {
  prepaid: WalletCard[];
  cashcard: WalletCard[];
  others: WalletCard[];
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  userName = '';
  activeAccountTab: CardType = 'prepaid';
  isAddCardModalOpen = false;
  isTopUpModalOpen = false;
  isNotificationsOpen = false;
  activeCardSlide = 0;
  topUpError = '';
  topUpSuccess = '';
  walletLoadError = '';
  private cardActivityRequestId = 0;
  private topUpSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  /** Soft-hide banner for this Home visit only. */
  private lowBalanceSoftHidden = false;
  private cardActivityLoaded = false;
  private loadedActivityCardKey = '';

  cardsByType: CardsByTypeMap = {
    prepaid: [],
    cashcard: [],
    others: [],
  };

  accountTabs: AccountTab[] = [
    { id: 'prepaid', label: 'PREPAID' },
    { id: 'cashcard', label: 'CASHCARD' },
    { id: 'others', label: 'OTHERS' },
  ];

  quickActions: HomeQuickAction[] = [
    { label: 'Pay', icon: 'paper-plane', color: '#d71920', route: '/tabs/pay' },
    { label: 'Top Up', icon: 'add', color: '#27ae60', action: 'top-up' },
    {
      label: 'QR Code',
      icon: 'qr-code',
      color: '#3498db',
      route: '/tabs/home/home-qr-code',
    },
    {
      label: 'More',
      icon: 'grid',
      color: '#9b59b6',
      route: '/tabs/home/home-more',
    },
  ];

  secondaryActions: HomeSecondaryAction[] = [
    {
      label: 'Payogotchi',
      icon: 'gift',
      color: '#f2994a',
      route: '/tabs/payogotchi/payogotchi-home',
    },
    {
      label: 'Tx History',
      icon: 'card',
      color: '#2f80ed',
      route: '/tabs/home/home-all-transactions',
    },
    {
      label: 'Rewards',
      icon: 'ribbon',
      color: '#f2c94c',
      route: '/tabs/rewards',
    },
    {
      label: 'Exchange',
      icon: 'swap-horizontal',
      color: '#9b51e0',
      route: '/tabs/fx-tracker',
    },
  ];

  insight = {
    title: 'Loading insights…',
    message: 'Analyzing your spending across all cards.',
  };
  insightStyle = { icon: 'sparkles', color: '#6c63ff', bg: '#ede7f6' };
  cardCurrencyBalances: CardCurrencyBalance[] = [];
  dnaTraits: string[] = [];
  insightLoadError = '';
  notifications: AppNotification[] = [];
  notificationUnreadCount = 0;

  monthlySummary = {
    month: '',
    totalIn: 0,
    totalInChange: 0,
    totalSpent: 0,
    totalSpentChange: 0,
  };
  spendingPeriod: 'Monthly' | 'Weekly' = 'Monthly';
  isPeriodSheetOpen = false;
  readonly spendingPeriodOptions = [
    { id: 'Monthly', label: 'Monthly' },
    { id: 'Weekly', label: 'Weekly' },
  ];
  spendingCategories: HomeSpendingCategory[] = [];
  recentTransactions: HomeRecentTransaction[] = [];
  isCardActivityLoading = false;

  rewards = { currentPoints: 3820, targetPoints: 5000 };

  constructor(
    private router: Router,
    private auth: AuthService,
    private cardContext: CardContextService,
    private pointsService: PointsService,
    private petBridge: PetBridgeService,
    public petService: PetService,
    private homeActivity: HomeActivityService,
    private homeWallet: HomeWalletService,
    private homeAlerts: HomeAlertsService,
  ) {}

  get visibleLoginAlert(): AppNotification | null {
    return this.homeAlerts.visibleLoginAlert;
  }

  get loginAlertOverflowCount(): number {
    return this.homeAlerts.overflowCount;
  }

  ionViewWillEnter(): void {
    const user = this.auth.currentUser;
    this.userName = user?.name.split(' ')[0] ?? 'Guest';
    this.rewards.currentPoints = user?.points ?? 0;
    this.refreshPointsBalance(user?.id ?? 'user_1');
    const showLoginAlerts = this.auth.consumeFreshLogin();
    this.lowBalanceSoftHidden = false;
    if (this.currentCard) {
      this.isCardActivityLoading = true;
    }

    const exchangeTime = localStorage.getItem('nets_exchange_applied_at');
    const skipReload =
      exchangeTime && Date.now() - parseInt(exchangeTime, 10) < 30000;

    if (!skipReload) {
      this.loadCardsForUser(user?.id ?? 'user_1');
    } else {
      this.syncSelectedCard();
    }
    this.loadMultiCurrencyBalances();
    this.loadNotifications(user?.id ?? 'user_1', showLoginAlerts);
    this.setupExchangeListener();
  }

  ionViewWillLeave(): void {
    this.homeAlerts.clearLoginAlertTimer();
    this.clearTopUpSuccessTimer();
  }

  private refreshPointsBalance(userId: string): void {
    this.pointsService.getBalance(userId).subscribe({
      next: (res) => (this.rewards.currentPoints = res.totalPoints),
      error: (err) => console.error('Failed to refresh points balance', err),
    });
  }

  private get spendingPeriodKey(): 'monthly' | 'weekly' {
    return this.spendingPeriod === 'Weekly' ? 'weekly' : 'monthly';
  }

  get showCardActivitySkeleton(): boolean {
    return this.isCardActivityLoading && !this.cardActivityLoaded;
  }

  get isRefreshingCardActivity(): boolean {
    return this.isCardActivityLoading && this.cardActivityLoaded;
  }

  get activeCards(): WalletCard[] {
    return this.cardsByType[this.activeAccountTab];
  }

  get totalCardSlides(): number {
    return this.activeCards.length + 1;
  }

  get cardSlides(): number[] {
    return Array.from({ length: this.totalCardSlides }, (_, index) => index);
  }

  get currentCard(): WalletCard | null {
    if (this.activeCardSlide >= this.activeCards.length) {
      return null;
    }
    return this.activeCards[this.activeCardSlide];
  }

  get cardFundsAmount(): number {
    return getCardFundsAmount(this.currentCard);
  }

  get addCardSlideSubtitle(): string {
    const subtitles: Record<CardType, string> = {
      prepaid: 'Link a new prepaid card',
      cashcard: 'Link a new CashCard',
      others: 'Link a bank debit or credit card',
    };
    return subtitles[this.activeAccountTab];
  }

  get canTopUpCurrentCard(): boolean {
    return canManualTopUpWalletCard(this.currentCard);
  }

  get isAutoTopUpActive(): boolean {
    return isAutoTopUpEnabled(this.currentCard);
  }

  get showLowBalanceAlert(): boolean {
    const userId = this.auth.userId;
    const card = this.currentCard;
    if (!userId || !card?.id || !canManualTopUpWalletCard(card)) {
      return false;
    }
    if (!isLowBalanceAlertsEnabled(userId)) {
      return false;
    }
    if (this.cardFundsAmount >= LOW_BALANCE_THRESHOLD) {
      return false;
    }
    return !this.lowBalanceSoftHidden;
  }

  get lowBalanceAlertBalance(): string {
    return `$${this.cardFundsAmount.toFixed(2)}`;
  }

  get lowBalanceAlertCardLabel(): string {
    if (!this.currentCard) {
      return 'This card';
    }
    return this.currentCard.cardType === 'cashcard'
      ? 'CashCard'
      : 'Prepaid card';
  }

  get canUsePayAndQr(): boolean {
    return Boolean(
      this.currentCard && this.currentCard.cardType !== 'cashcard',
    );
  }

  get payFeatureDisabledReason(): string {
    return 'NETS CashCard is for transit and gantry. Switch to Prepaid or a linked card on Home to use Pay or QR.';
  }

  get topUpDisabledReason(): string {
    return walletTopUpReason(this.currentCard);
  }

  get spendingPeriodButtonLabel(): string {
    if (this.spendingPeriod === 'Weekly') {
      return this.monthlySummary.month || 'Weekly';
    }
    return this.monthlySummary.month || 'Monthly';
  }

  get pet() {
    return this.petService.state;
  }

  get xpPercent(): number {
    return this.petService.xpProgress * 100;
  }

  selectAccountTab(tabId: CardType): void {
    this.activeAccountTab = tabId;
    this.activeCardSlide = 0;
    this.topUpError = '';
    this.syncSelectedCard();
    this.reloadCardActivity();
  }

  toggleCardSensitiveDetails(): void {
    this.cardContext.toggleSensitiveDetails();
  }

  prevCardSlide(): void {
    this.activeCardSlide =
      (this.activeCardSlide - 1 + this.totalCardSlides) % this.totalCardSlides;
    this.syncSelectedCard();
    this.reloadCardActivity();
  }

  nextCardSlide(): void {
    this.activeCardSlide = (this.activeCardSlide + 1) % this.totalCardSlides;
    this.syncSelectedCard();
    this.reloadCardActivity();
  }

  goToCardSlide(index: number): void {
    this.activeCardSlide = index;
    this.syncSelectedCard();
    this.reloadCardActivity();
  }

  openFullReport(): void {
    this.router.navigate(['/tabs/home/home-full-report']);
  }

  openAiInsights(): void {
    this.router.navigate(['/tabs/home/home-ai-insights']);
  }

  openAllTransactions(): void {
    const card = this.currentCard;
    const query = card
      ? this.homeActivity.buildCardQuery(card, this.cardsByType)
      : {};
    this.router.navigate(['/tabs/home/home-all-transactions'], {
      queryParams: {
        cardId: query.cardId || null,
        cardNumber: query.cardNumber || null,
      },
    });
  }

  toggleSpendingPeriodMenu(): void {
    this.isPeriodSheetOpen = true;
  }

  closeSpendingPeriodSheet(): void {
    this.isPeriodSheetOpen = false;
  }

  onSpendingPeriodSelected(periodId: string): void {
    this.spendingPeriod = periodId as 'Monthly' | 'Weekly';
    this.isPeriodSheetOpen = false;
    this.reloadCardActivity();
  }

  onQuickAction(action: HomeQuickAction): void {
    if (action.action === 'top-up' && !this.canTopUpCurrentCard) {
      this.topUpError = this.topUpDisabledReason;
      return;
    }
    if (
      (action.label === 'Pay' || action.label === 'QR Code') &&
      !this.canUsePayAndQr
    ) {
      this.topUpError = this.payFeatureDisabledReason;
      return;
    }
    if (action.action === 'top-up') {
      this.openTopUpModal();
      return;
    }
    if (action.route) {
      this.router.navigate([action.route]);
    }
  }

  onSecondaryAction(action: HomeSecondaryAction): void {
    if (action.route) {
      this.router.navigate([action.route]);
    }
  }

  openPayogotchiSetup(): void {
    this.router.navigate(['/tabs/payogotchi']);
  }

  openAddCardModal(): void {
    this.isAddCardModalOpen = true;
  }

  closeAddCardModal(): void {
    this.isAddCardModalOpen = false;
  }

  onCardLinked(event: HomeCardLinkedEvent): void {
    this.cardsByType[event.cardType] = [
      ...this.cardsByType[event.cardType],
      event.card,
    ];
    if (this.activeAccountTab !== event.cardType) {
      this.activeAccountTab = event.cardType;
    }
    this.activeCardSlide = this.activeCards.length - 1;
    this.closeAddCardModal();
    this.syncSelectedCard();
    this.reloadCardActivity();
  }

  openTopUpModal(): void {
    if (!this.currentCard) {
      this.openAddCardModal();
      return;
    }
    if (!this.canTopUpCurrentCard) {
      this.topUpError = this.topUpDisabledReason;
      return;
    }
    this.topUpError = '';
    this.clearTopUpSuccess();
    this.isTopUpModalOpen = true;
  }

  closeTopUpModal(): void {
    this.isTopUpModalOpen = false;
  }

  onTopUpRequestAddCard(): void {
    this.closeTopUpModal();
    this.openAddCardModal();
  }

  onTopUpCompleted(event: HomeTopUpCompletedEvent): void {
    this.updateWalletCard(event.card);
    if (event.sourceCard) {
      this.updateWalletCard(event.sourceCard);
    }
    this.showTopUpSuccess(event.message);
    this.topUpError = '';
    this.closeTopUpModal();
    this.syncSelectedCard();
    this.reloadCardActivity();
  }

  openNotifications(): void {
    this.isNotificationsOpen = true;
    const userId = this.auth.userId;
    if (!userId || this.notificationUnreadCount === 0) {
      return;
    }
    this.homeAlerts.markAllRead(userId).subscribe({
      next: (response) => {
        this.notificationUnreadCount = response.unreadCount;
        this.notifications = this.notifications.map((entry) => ({
          ...entry,
          read: true,
        }));
      },
    });
  }

  closeNotifications(): void {
    this.isNotificationsOpen = false;
  }

  notificationAmount(entry: AppNotification | null): string | null {
    return formatNotificationAmount(entry);
  }

  notificationSender(entry: AppNotification | null): string {
    return formatNotificationSender(entry);
  }

  dismissLowBalanceAlert(event?: Event): void {
    event?.stopPropagation();
    this.lowBalanceSoftHidden = true;
  }

  openLowBalanceTopUp(event?: Event): void {
    event?.stopPropagation();
    this.openTopUpModal();
  }

  dismissLoginAlert(event?: Event): void {
    event?.stopPropagation();
    this.homeAlerts.dismissVisibleAlert();
  }

  openLoginAlertDetails(): void {
    this.dismissLoginAlert();
    this.openNotifications();
  }

  goToFxTracker(): void {
    this.router.navigate(['/tabs/fx-tracker']);
  }

  private loadNotifications(userId: string, showLoginAlerts: boolean): void {
    this.homeAlerts.list(userId).subscribe({
      next: (response) => {
        this.notifications = response.notifications;
        this.notificationUnreadCount = response.unreadCount;
        if (showLoginAlerts) {
          this.homeAlerts.queueLoginAlerts(
            response.notifications.filter((entry) => !entry.read),
          );
        }
      },
    });
  }

  private showTopUpSuccess(message: string): void {
    this.clearTopUpSuccessTimer();
    this.topUpSuccess = message;
    this.topUpSuccessTimer = setTimeout(() => {
      this.topUpSuccess = '';
      this.topUpSuccessTimer = null;
    }, 3000);
  }

  private clearTopUpSuccess(): void {
    this.clearTopUpSuccessTimer();
    this.topUpSuccess = '';
  }

  private clearTopUpSuccessTimer(): void {
    if (this.topUpSuccessTimer) {
      clearTimeout(this.topUpSuccessTimer);
      this.topUpSuccessTimer = null;
    }
  }

  private loadCardsForUser(userId: string): void {
    this.walletLoadError = '';
    this.homeWallet.loadWallet(userId).subscribe({
      next: (wallet) => {
        this.cardsByType = wallet;
        this.homeWallet.persistWalletSgdSnapshot(userId, wallet);
        if (
          this.activeCardSlide >= this.activeCards.length &&
          this.activeCards.length > 0
        ) {
          this.activeCardSlide = this.activeCards.length - 1;
        }
        this.syncSelectedCard();
        this.loadOverallInsight(userId);
        this.reloadCardActivity();
      },
      error: () => {
        this.cardsByType = { ...EMPTY_CARDS_BY_TYPE };
        this.walletLoadError =
          'Could not load your cards. Restart with npm start or ionic serve so the backend runs on port 3000.';
        this.clearCardActivity();
      },
    });
  }

  private syncSelectedCard(): void {
    this.topUpError = '';
    if (this.currentCard) {
      this.cardContext.selectCard(this.currentCard);
      this.homeWallet.clearLowBalanceDismissIfRecovered(
        this.auth.userId,
        this.currentCard,
      );
    }
    const userId = this.auth.userId;
    if (this.currentCard && userId) {
      this.homeWallet.persistCurrentCardSelection(
        userId,
        this.currentCard,
        this.cardFundsAmount,
      );
    }
    this.loadMultiCurrencyBalances();
  }

  private reloadCardActivity(): void {
    this.syncSelectedCard();
    const card = this.currentCard;
    if (!card) {
      this.isCardActivityLoading = false;
      this.cardActivityLoaded = false;
      this.loadedActivityCardKey = '';
      this.clearCardActivity();
      return;
    }

    const cardKey = card.id || card.cardNumber;
    if (cardKey !== this.loadedActivityCardKey) {
      this.clearCardActivity();
      this.cardActivityLoaded = false;
      this.loadedActivityCardKey = cardKey;
    }

    this.isCardActivityLoading = true;
    this.loadCardActivity(this.auth.userId ?? 'user_1');
  }

  private loadOverallInsight(userId: string): void {
    this.homeActivity.loadOverallInsight(userId).subscribe({
      next: (view) => {
        this.dnaTraits = view.traits;
        this.insight = { title: view.title, message: view.message };
        this.insightStyle = view.style;
        this.insightLoadError = view.error;
      },
    });
  }

  private loadCardActivity(userId: string): void {
    const card = this.currentCard;
    if (!card) {
      this.clearCardActivity();
      return;
    }

    const requestId = ++this.cardActivityRequestId;
    this.homeActivity
      .loadCardActivity(userId, card, this.cardsByType, this.spendingPeriodKey)
      .subscribe({
        next: (activity) => {
          if (requestId !== this.cardActivityRequestId || !activity) {
            return;
          }
          this.monthlySummary = activity.monthlySummary;
          this.spendingCategories = activity.spendingCategories;
          this.recentTransactions = activity.recentTransactions;
          this.isCardActivityLoading = false;
          this.cardActivityLoaded = true;
        },
        error: () => {
          if (requestId !== this.cardActivityRequestId) {
            return;
          }
          this.clearCardActivity();
          this.isCardActivityLoading = false;
        },
      });
  }

  private clearCardActivity(): void {
    const empty = this.homeActivity.emptyActivity();
    this.monthlySummary = empty.monthlySummary;
    this.spendingCategories = empty.spendingCategories;
    this.recentTransactions = empty.recentTransactions;
    this.cardActivityLoaded = false;
  }

  private updateWalletCard(updatedCard: WalletCard): void {
    this.cardsByType = this.homeWallet.replaceCardInWallet(
      this.cardsByType,
      updatedCard,
    );
    this.homeWallet.clearLowBalanceDismissIfRecovered(
      this.auth.userId,
      updatedCard,
    );
    this.loadMultiCurrencyBalances();
  }

  loadMultiCurrencyBalances(): void {
    const userId = this.auth.userId;
    const card = this.currentCard;
    if (!userId || !card?.id) {
      this.cardCurrencyBalances = [];
      return;
    }
    this.homeWallet
      .loadCurrencyBalances(userId, card.id, this.cardFundsAmount)
      .subscribe({
        next: (balances) => {
          this.cardCurrencyBalances = balances;
        },
      });
  }

  private exchangeListenersSetup = false;

  private setupExchangeListener(): void {
    if (this.exchangeListenersSetup) return; // ← Prevent duplicates
    this.exchangeListenersSetup = true;

    window.addEventListener('nets:exchangeCompleted', () => {
      this.loadMultiCurrencyBalances();
      this.loadCardsForUser(this.auth.userId ?? 'user_1');
    });

    window.addEventListener('nets:travelPaymentCompleted', (event: any) => {
      const detail = event.detail;
      if (!detail) return;

      // Just refresh from backend — transaction is already saved there
      this.loadMultiCurrencyBalances();
      this.loadCardsForUser(this.auth.userId ?? 'user_1');
      this.reloadCardActivity();

      // Immediate points feedback
      if (detail.pointsEarned) {
        this.refreshPointsBalance(this.auth.userId ?? 'user_1');
        this.rewards.currentPoints += detail.pointsEarned;
      }
    });
  }

  private saveLocalTransaction(txn: HomeRecentTransaction): void {
    const userId = this.auth.userId;
    if (!userId) return;
    const key = `nets_local_txns_${userId}`;
    const existing = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    existing.unshift({
      ...txn,
      id: `travel_${Date.now()}`,
      cardId: this.currentCard?.id,
      xpGained: txn.displayXp ?? 0,
      xpCapped: Boolean(txn.rewardsLimitLabel),
      xpRecorded: txn.displayXp != null || Boolean(txn.rewardsLimitLabel),
    });
    sessionStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
  }
}
