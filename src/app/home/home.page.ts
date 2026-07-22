import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CardType, AccountKind, CardsService, FALLBACK_REGISTRY, LINKABLE_BANKS, RegistryCard, TopUpMethod, WalletCard, formatCardPaymentLabel, getCardBrandBadge, getCardFundsAmount, getCardFundsLabel, getCardFundsSubtext, getCardThemeClass } from '../services/cards.service';
import { CardContextService } from '../services/card-context.service';
import { AppNotification, NotificationsService } from '../services/notifications.service';
import { TransactionsService } from '../services/transactions.service';
import { formatTransactionMeta } from '../utils/transfer-display';
import { sanitizeDecimalAmountInput } from '../utils/amount-input';
import { applySanitizedIonInput, sanitizeCvvInput, sanitizeExpiryInput } from '../utils/input-validation';
import {
  displayedCardBalance as formatDisplayedCardBalance,
  displayedCardExpiry as formatDisplayedCardExpiry,
  displayedCardNumber as formatDisplayedCardNumber,
} from '../utils/card-display';
import { buildTopUpFundingOptions, canManualTopUpWalletCard, isAutoTopUpEnabled, LOW_BALANCE_THRESHOLD, manualTopUpDisabledReason as walletTopUpReason, TopUpFundingOption } from '../utils/wallet-topup';
import {
  clearLowBalanceDismiss,
  dismissLowBalanceReminder,
  isLowBalanceAlertsEnabled,
  isLowBalanceDismissed,
} from '../utils/notification-preferences';
import { PointsService } from 'shared/points.service';

interface AccountTab {
  id: CardType;
  label: string;
}

interface QuickAction {
  label: string;
  icon: string;
  color: string;
  route?: string;
  action?: 'top-up';
}

interface SpendingCategory {
  label: string;
  amount: number;
  color: string;
}

interface Transaction {
  merchant: string;
  subtitle: string;
  amount: number;
  date: string;
  time: string;
  icon: string;
  iconColor: string;
  type: 'debit' | 'credit';
}

interface SecondaryAction {
  label: string;
  icon: string;
  color: string;
  route?: string;
}

interface PrepaidCardForm {
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
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
  readonly Math = Math;
  userName = '';
  activeAccountTab: CardType = 'prepaid';
  isAddCardModalOpen = false;
  isTopUpModalOpen = false;
  isNotificationsOpen = false;
  activeCardSlide = 0;
  formError = '';
  topUpError = '';
  topUpSuccess = '';
  walletLoadError = '';
  isLinkingCard = false;
  isToppingUp = false;
  topUpAmount = 10;
  topUpAmountText = '10';
  selectedTopUpFundingId = '';
  topUpFundingOptions: TopUpFundingOption[] = [];
  linkBankName = 'DBS';
  linkAccountKind: AccountKind = 'debit';
  linkDefaultReceive = true;
  readonly linkBankOptions = LINKABLE_BANKS;
  readonly quickTopUpAmounts = [10, 20, 50, 100, 200, 500];
  registryCards: RegistryCard[] = FALLBACK_REGISTRY;
  selectedLinkCardType: CardType | null = null;
  private cardActivityRequestId = 0;

  cardsByType: CardsByTypeMap = {
    prepaid: [],
    cashcard: [],
    others: [],
  };

  newCardForm: PrepaidCardForm = {
    cardNumber: '',
    cardholderName: '',
    expiryDate: '',
    cvv: '',
  };

  /** Minimum valid expiry: after June 2026 (review in July) */
  private readonly minExpiryYear = 26;
  private readonly minExpiryMonth = 7;

  accountTabs: AccountTab[] = [
    { id: 'prepaid', label: 'PREPAID' },
    { id: 'cashcard', label: 'CASHCARD' },
    { id: 'others', label: 'OTHERS' },
  ];

  constructor(
    private router: Router,
    private auth: AuthService,
    private cardsService: CardsService,
    private cardContext: CardContextService,
    private transactionsService: TransactionsService,
    private notificationsService: NotificationsService,
    private pointsService: PointsService   // ← add
  ) {}

  quickActions: QuickAction[] = [
    { label: 'Pay', icon: 'paper-plane', color: '#d71920', route: '/tabs/pay' },
    { label: 'Top Up', icon: 'add', color: '#27ae60', action: 'top-up' },
    { label: 'QR Code', icon: 'qr-code', color: '#3498db', route: '/tabs/home/home-qr-code' },
    { label: 'More', icon: 'grid', color: '#9b59b6', route: '/tabs/home/home-more' },
  ];

  insight = {
    title: 'Loading insights…',
    message: 'Analyzing your spending across all cards.',
  };

  insightStyle = {
    icon: 'sparkles',
    color: '#6c63ff',
    bg: '#ede7f6',
  };

  dnaTraits: string[] = [];
  insightLoadError = '';
  notifications: AppNotification[] = [];
  notificationUnreadCount = 0;
  visibleLoginAlert: AppNotification | null = null;
  loginAlertQueue: AppNotification[] = [];
  private loginAlertTimer: ReturnType<typeof setTimeout> | null = null;
  private topUpSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  isSavingTopUpPreference = false;

  monthlySummary = {
    month: 'June 2026',
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

  spendingCategories: SpendingCategory[] = [];

  recentTransactions: Transaction[] = [];

  rewards = {
    currentPoints: 3820,
    targetPoints: 5000,
  };

  secondaryActions: SecondaryAction[] = [
    { label: 'Payogotchi', icon: 'gift', color: '#f2994a' },
    { label: 'Tx History', icon: 'card', color: '#2f80ed', route: '/tabs/home/home-all-transactions' },
    { label: 'Rewards', icon: 'ribbon', color: '#f2c94c' },
    { label: 'Exchange', icon: 'swap-horizontal', color: '#9b51e0', route: '/tabs/fx-tracker' },
  ];

  ionViewWillEnter(): void {
    const user = this.auth.currentUser;
    this.userName = user?.name.split(' ')[0] ?? 'Guest';
    this.rewards.currentPoints = user?.points ?? 0;
    this.refreshPointsBalance(user?.id ?? 'user_1');   // ← add this line
    const showLoginAlerts = this.auth.consumeFreshLogin();
    this.loadCardsForUser(user?.id ?? 'user_1');
    this.loadNotifications(user?.id ?? 'user_1', showLoginAlerts);
  }

  private refreshPointsBalance(userId: string): void {
  this.pointsService.getBalance(userId).subscribe({
    next: (res) => (this.rewards.currentPoints = res.totalPoints),
    error: (err) => console.error('Failed to refresh points balance', err),
  });
}

  ionViewWillLeave(): void {
    this.clearLoginAlertTimer();
    this.clearTopUpSuccessTimer();
  }

  private get spendingPeriodKey(): 'monthly' | 'weekly' {
    return this.spendingPeriod === 'Weekly' ? 'weekly' : 'monthly';
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

  get cardThemeClass(): string {
    return getCardThemeClass(this.currentCard);
  }

  get cardBrandBadge(): string {
    return getCardBrandBadge(this.currentCard);
  }

  get cardFundsLabel(): string {
    return getCardFundsLabel(this.currentCard);
  }

  get cardFundsAmount(): number {
    return getCardFundsAmount(this.currentCard);
  }

  get cardFundsSubtext(): string | null {
    return getCardFundsSubtext(this.currentCard);
  }

  get showCardSensitiveDetails(): boolean {
    return this.cardContext.getShowSensitiveDetails();
  }

  get displayedCardBalance(): string {
    return formatDisplayedCardBalance(this.currentCard, this.showCardSensitiveDetails);
  }

  get displayedCardNumber(): string {
    return formatDisplayedCardNumber(this.currentCard, this.showCardSensitiveDetails);
  }

  get displayedTopUpCardRef(): string {
    return this.currentCard ? formatCardPaymentLabel(this.currentCard) : '';
  }

  get displayedTopUpBalance(): string {
    return formatDisplayedCardBalance(this.currentCard, true);
  }

  get showCardFundsSubtext(): boolean {
    return this.showCardSensitiveDetails && Boolean(this.cardFundsSubtext);
  }

  get displayedCardExpiry(): string {
    return formatDisplayedCardExpiry(this.currentCard?.expiryDate, this.showCardSensitiveDetails);
  }

  toggleCardSensitiveDetails(): void {
    this.cardContext.toggleSensitiveDetails();
  }

  displayedFundingTitle(title: string): string {
    return title;
  }

  displayedFundingSubtitle(subtitle: string): string {
    return subtitle;
  }

  get addCardModalTitle(): string {
    const titles: Record<CardType, string> = {
      prepaid: 'Add PREPAID Card',
      cashcard: 'Add CashCard',
      others: 'Link Bank Card',
    };
    return titles[this.activeAccountTab];
  }

  get addCardSlideSubtitle(): string {
    const subtitles: Record<CardType, string> = {
      prepaid: 'Link a new prepaid card',
      cashcard: 'Link a new CashCard',
      others: 'Link a bank debit or credit card',
    };
    return subtitles[this.activeAccountTab];
  }

  get showBankCardFields(): boolean {
    return this.activeAccountTab === 'others' || this.selectedLinkCardType === 'others';
  }

  get showCardholderField(): boolean {
    return this.showBankCardFields;
  }

  get balanceLookupNotice(): string {
    if (this.activeAccountTab === 'others') {
      return 'Enter any 16-digit card not already linked. Debit and credit balances are simulated for this demo.';
    }
    return 'Enter any unused 16-digit card number. NETS will verify it and show a simulated balance.';
  }

  get activeRegistryCards(): RegistryCard[] {
    return this.registryCards.filter((card) => card.cardType === this.activeAccountTab);
  }

  get activeRegistryLabel(): string {
    const labels: Record<CardType, string> = {
      prepaid: 'PREPAID',
      cashcard: 'CASHCARD',
      others: 'OTHERS',
    };
    return labels[this.activeAccountTab];
  }

  get maxSpendingAmount(): number {
    if (!this.spendingCategories.length) {
      return 1;
    }
    return Math.max(...this.spendingCategories.map((c) => c.amount));
  }

  getBarHeight(amount: number): number {
    return (amount / this.maxSpendingAmount) * 100;
  }

  get rewardsProgress(): number {
    return (this.rewards.currentPoints / this.rewards.targetPoints) * 100;
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
    return !isLowBalanceDismissed(userId, card.id);
  }

  get lowBalanceAlertBalance(): string {
    return `$${this.cardFundsAmount.toFixed(2)}`;
  }

  get lowBalanceAlertCardLabel(): string {
    if (!this.currentCard) {
      return 'This card';
    }
    return this.currentCard.cardType === 'cashcard' ? 'CashCard' : 'Prepaid card';
  }

  get canUsePayAndQr(): boolean {
    return Boolean(this.currentCard && this.currentCard.cardType !== 'cashcard');
  }

  get payFeatureDisabledReason(): string {
    return 'NETS CashCard is for transit and gantry. Switch to Prepaid or a linked card on Home to use Pay or QR.';
  }

  isQuickActionDisabled(action: QuickAction): boolean {
    if (action.action === 'top-up') {
      return !this.canTopUpCurrentCard;
    }

    if (action.label === 'Pay' || action.label === 'QR Code') {
      return !this.canUsePayAndQr;
    }

    return false;
  }

  getQuickActionTitle(action: QuickAction): string | null {
    if (action.action === 'top-up' && !this.canTopUpCurrentCard) {
      return this.topUpDisabledReason;
    }

    if ((action.label === 'Pay' || action.label === 'QR Code') && !this.canUsePayAndQr) {
      return this.payFeatureDisabledReason;
    }

    return null;
  }

  get topUpDisabledReason(): string {
    return walletTopUpReason(this.currentCard);
  }

  get topUpButtonLabel(): string {
    const amount = this.topUpAmount.toFixed(2).replace(/\.?0+$/, '');
    return `Top Up $${amount}`;
  }

  selectAccountTab(tabId: CardType): void {
    this.activeAccountTab = tabId;
    this.activeCardSlide = 0;
    this.topUpError = '';
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
    this.router.navigate(['/tabs/home/home-all-transactions']);
  }

  toggleSpendingPeriodMenu(): void {
    this.isPeriodSheetOpen = true;
  }

  closeSpendingPeriodSheet(): void {
    this.isPeriodSheetOpen = false;
  }

  onSpendingPeriodSelected(periodId: string): void {
    this.setSpendingPeriod(periodId as 'Monthly' | 'Weekly');
    this.isPeriodSheetOpen = false;
  }

  get spendingPeriodButtonLabel(): string {
    if (this.spendingPeriod === 'Weekly') {
      return this.monthlySummary.month || 'Weekly';
    }
    return this.monthlySummary.month || 'Monthly';
  }

  setSpendingPeriod(period: 'Monthly' | 'Weekly'): void {
    this.spendingPeriod = period;
    this.isPeriodSheetOpen = false;
    this.reloadCardActivity();
  }

  onQuickAction(action: QuickAction): void {
    if (this.isQuickActionDisabled(action)) {
      if (action.action === 'top-up') {
        this.topUpError = this.topUpDisabledReason;
      } else if (action.label === 'Pay' || action.label === 'QR Code') {
        this.topUpError = this.payFeatureDisabledReason;
      }
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

  onSecondaryAction(action: SecondaryAction): void {
    if (action.route) {
      this.router.navigate([action.route]);
    }
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
    this.topUpAmount = 10;
    this.topUpAmountText = '10';
    this.buildTopUpFundingOptions();
    this.isTopUpModalOpen = true;
  }

  private buildTopUpFundingOptions(): void {
    const options = buildTopUpFundingOptions(this.cardsByType);
    this.topUpFundingOptions = options;
    this.selectedTopUpFundingId = options[0]?.id ?? '';
  }

  closeTopUpModal(): void {
    this.isTopUpModalOpen = false;
    this.topUpError = '';
    this.isToppingUp = false;
  }

  selectTopUpAmount(amount: number): void {
    this.topUpAmount = amount;
    this.topUpAmountText = String(amount);
    this.topUpError = '';
  }

  onTopUpAmountInput(event: CustomEvent): void {
    const { text, amount } = sanitizeDecimalAmountInput(String(event.detail.value ?? ''));
    this.topUpAmountText = text;
    this.topUpAmount = amount;
    applySanitizedIonInput(event, text);
    this.topUpError = '';
  }

  selectTopUpFunding(fundingId: string): void {
    this.selectedTopUpFundingId = fundingId;
    this.topUpError = '';
  }

  submitTopUp(): void {
    this.topUpError = '';

    const card = this.currentCard;
    const userId = this.auth.userId;

    if (!card || !userId) {
      this.topUpError = 'Please log in and select a card to top up.';
      return;
    }

    if (this.topUpAmount < 0.01) {
      this.topUpError = 'Enter an amount of at least $0.01.';
      return;
    }

    const cardId = card.id || this.findCardIdByNumber(card.cardNumber);
    if (!cardId) {
      this.topUpError = 'Unable to identify this card. Refresh the page and try again.';
      return;
    }

    const funding =
      this.topUpFundingOptions.find((option) => option.id === this.selectedTopUpFundingId) ??
      this.topUpFundingOptions[0];

    if (!funding) {
      this.topUpError = 'Select a payment method.';
      return;
    }

    this.isToppingUp = true;

    this.cardsService
      .topUpCard(userId, cardId, {
        amount: this.topUpAmount,
        method: funding.method,
        sourceCardId: funding.sourceCardId,
      })
      .subscribe({
        next: (response) => {
          this.updateWalletCard(response.card);
          if (funding.sourceCardId && response.sourceCard) {
            this.updateWalletCard(response.sourceCard);
          }
          this.isToppingUp = false;
          this.showTopUpSuccess(response.message);
          this.topUpError = '';
          this.closeTopUpModal();
          this.syncSelectedCard();
          this.reloadCardActivity();
        },
        error: (err) => {
          this.isToppingUp = false;
          this.topUpError =
            err.error?.error ?? 'Unable to top up. Make sure the backend is running on port 3000.';
        },
      });
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

  openAddCardModal(): void {
    this.formError = '';
    this.selectedLinkCardType = null;
    this.linkBankName = 'DBS';
    this.linkAccountKind = 'debit';
    this.linkDefaultReceive = true;
    this.isAddCardModalOpen = true;
    this.cardsService.getRegistry().subscribe((cards) => {
      this.registryCards = cards;
    });
  }

  closeAddCardModal(): void {
    this.isAddCardModalOpen = false;
    this.formError = '';
    this.selectedLinkCardType = null;
    this.resetNewCardForm();
  }

  useRegistryCard(card: RegistryCard): void {
    this.formError = '';
    this.selectedLinkCardType = card.cardType;
    this.newCardForm.cardNumber = card.cardNumber;
    this.newCardForm.expiryDate = card.expiryDate || '07/28';
    this.newCardForm.cvv = card.cvv || '123';
    this.newCardForm.cardholderName = card.requiresCardholder ? card.cardholderName ?? 'ADAM LIM' : '';
    if (card.cardType === 'others') {
      this.linkBankName = card.bankName ?? 'DBS';
      this.linkAccountKind = card.accountKind ?? 'debit';
    }
  }

  selectLinkAccountKind(kind: AccountKind): void {
    this.linkAccountKind = kind;
    if (kind === 'credit') {
      this.linkDefaultReceive = false;
    }
  }

  registryCardholderHint(card: RegistryCard): string {
    if (card.requiresCardholder) {
      return card.cardholderName ?? 'ADAM LIM';
    }
    return this.auth.currentUser?.name.toUpperCase() ?? 'YOUR LOGIN NAME';
  }

  addCard(): void {
    this.formError = '';
    const userId = this.auth.userId;
    if (!userId) {
      this.formError = 'Please log in to link a card.';
      return;
    }

    const digits = this.newCardForm.cardNumber.replace(/\s/g, '');
    const name = this.newCardForm.cardholderName.trim();
    const expiry = this.newCardForm.expiryDate.trim();
    const cvv = this.newCardForm.cvv.trim();

    if (digits.length !== 16 || !/^\d+$/.test(digits)) {
      this.formError = 'Enter a valid 16-digit card number.';
      return;
    }

    if (this.showCardholderField) {
      if (name.length < 2 || !/^[A-Z\s]+$/.test(name)) {
        this.formError = 'Enter a valid name using letters only.';
        return;
      }
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      this.formError = 'Expiry must be in MM/YY format.';
      return;
    }

    if (!this.isExpiryAfterCurrentMonth(expiry)) {
      this.formError = 'Expiry must be July 2026 or later.';
      return;
    }

    if (!/^\d{3}$/.test(cvv)) {
      this.formError = 'CVV must be exactly 3 digits.';
      return;
    }

    this.isLinkingCard = true;
    const linkCardType = this.selectedLinkCardType ?? this.activeAccountTab;
    this.cardsService
      .linkCard(userId, {
        cardType: linkCardType,
        cardNumber: digits,
        cardholderName: this.showCardholderField ? name : undefined,
        expiryDate: expiry,
        cvv,
        bankName: this.showCardholderField ? this.linkBankName : undefined,
        accountKind: this.showCardholderField ? this.linkAccountKind : undefined,
        isDefaultReceive: this.showCardholderField && this.linkAccountKind === 'debit' ? this.linkDefaultReceive : undefined,
      })
      .subscribe({
        next: (response) => {
          this.cardsByType[linkCardType] = [...this.cardsByType[linkCardType], response.card];
          if (this.activeAccountTab !== linkCardType) {
            this.activeAccountTab = linkCardType;
          }
          this.activeCardSlide = this.activeCards.length - 1;
          this.isLinkingCard = false;
          this.closeAddCardModal();
          this.syncSelectedCard();
          this.reloadCardActivity();
        },
        error: (err) => {
          this.isLinkingCard = false;
          this.formError =
            err.error?.error ?? 'Unable to link card. Make sure the backend is running on port 3000.';
        },
      });
  }

  onCardNumberInput(event: CustomEvent): void {
    const value = String(event.detail.value ?? '');
    const digits = value.replace(/\D/g, '').slice(0, 16);
    this.newCardForm.cardNumber = digits ? this.formatCardNumber(digits) : '';
  }

  onCardholderNameInput(event: CustomEvent): void {
    const value = String(event.detail.value ?? '');
    const cleaned = value.replace(/[^a-zA-Z\s]/g, '');
    this.newCardForm.cardholderName = cleaned.toUpperCase();
  }

  onExpiryInput(event: CustomEvent): void {
    const sanitized = sanitizeExpiryInput(String(event.detail.value ?? ''));
    this.newCardForm.expiryDate = sanitized;
    applySanitizedIonInput(event, sanitized);
  }

  onCvvInput(event: CustomEvent): void {
    const sanitized = sanitizeCvvInput(String(event.detail.value ?? ''));
    this.newCardForm.cvv = sanitized;
    applySanitizedIonInput(event, sanitized);
  }

  resetNewCardForm(): void {
    this.newCardForm = {
      cardNumber: '',
      cardholderName: '',
      expiryDate: '',
      cvv: '',
    };
  }

  get previewCardNumber(): string {
    const digits = this.newCardForm.cardNumber.replace(/\s/g, '');
    if (!digits) {
      return '#### #### #### ####';
    }
    return this.formatCardNumber(digits.padEnd(16, '0').slice(0, 16));
  }

  get previewCardholder(): string {
    if (!this.showCardholderField) {
      return this.auth.currentUser?.name.toUpperCase() ?? 'YOUR NAME';
    }
    return this.newCardForm.cardholderName.trim() || 'YOUR NAME';
  }

  get previewExpiry(): string {
    return this.newCardForm.expiryDate.trim() || 'MM/YY';
  }

  private isExpiryAfterCurrentMonth(expiry: string): boolean {
    const [monthPart, yearPart] = expiry.split('/');
    const month = parseInt(monthPart, 10);
    const year = parseInt(yearPart, 10);

    if (year > this.minExpiryYear) {
      return true;
    }

    if (year === this.minExpiryYear && month >= this.minExpiryMonth) {
      return true;
    }

    return false;
  }

  formatAmount(amount: number): string {
    const prefix = amount >= 0 ? '+' : '-';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
  }

  onTopUpToggleChange(_enabled: boolean): void {
    // Auto-managed when balance drops below $50 — no manual toggle.
  }

  openNotifications(): void {
    this.isNotificationsOpen = true;
    const userId = this.auth.userId;
    if (!userId || this.notificationUnreadCount === 0) {
      return;
    }

    this.notificationsService.markAllRead(userId).subscribe({
      next: (response) => {
        this.notificationUnreadCount = response.unreadCount;
        this.notifications = this.notifications.map((entry) => ({ ...entry, read: true }));
      },
    });
  }

  closeNotifications(): void {
    this.isNotificationsOpen = false;
  }

  private loadNotifications(userId: string, showLoginAlerts: boolean): void {
    this.notificationsService.list(userId).subscribe({
      next: (response) => {
        this.notifications = response.notifications;
        this.notificationUnreadCount = response.unreadCount;
        if (showLoginAlerts) {
          this.queueLoginAlerts(response.notifications.filter((entry) => !entry.read));
        }
      },
    });
  }

  get loginAlertOverflowCount(): number {
    if (!this.visibleLoginAlert) {
      return 0;
    }
    return this.loginAlertQueue.length;
  }

  notificationAmount(entry: AppNotification | null): string | null {
    if (!entry) {
      return null;
    }
    const amount = Number(entry.meta?.['amount']);
    if (Number.isFinite(amount)) {
      return `$${amount.toFixed(2)}`;
    }
    const match = entry.message.match(/\$([\d,]+\.\d{2})/);
    return match ? `$${match[1]}` : null;
  }

  notificationSender(entry: AppNotification | null): string {
    if (!entry) {
      return '';
    }
    const fromMeta = entry.meta?.['fromName'];
    if (typeof fromMeta === 'string' && fromMeta.trim()) {
      return fromMeta.trim();
    }
    const match = entry.message.match(/^(.+?)\s+sent you/i);
    return match ? match[1].trim() : 'Someone';
  }

  dismissLowBalanceAlert(event?: Event): void {
    event?.stopPropagation();
    const userId = this.auth.userId;
    const cardId = this.currentCard?.id;
    if (userId && cardId) {
      dismissLowBalanceReminder(userId, cardId);
    }
  }

  openLowBalanceTopUp(event?: Event): void {
    event?.stopPropagation();
    this.openTopUpModal();
  }

  dismissLoginAlert(event?: Event): void {
    event?.stopPropagation();
    this.clearLoginAlertTimer();
    this.visibleLoginAlert = null;
    if (this.loginAlertQueue.length) {
      this.showNextLoginAlert();
    }
  }

  openLoginAlertDetails(): void {
    this.dismissLoginAlert();
    this.openNotifications();
  }

  private queueLoginAlerts(unread: AppNotification[]): void {
    this.clearLoginAlertTimer();
    this.loginAlertQueue = unread.slice(0, 3);
    this.visibleLoginAlert = null;
    this.showNextLoginAlert();
  }

  private showNextLoginAlert(): void {
    const next = this.loginAlertQueue.shift();
    if (!next) {
      return;
    }
    this.visibleLoginAlert = next;
    this.clearLoginAlertTimer();
    this.loginAlertTimer = setTimeout(() => this.dismissLoginAlert(), 7000);
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

  private clearLoginAlertTimer(): void {
    if (this.loginAlertTimer) {
      clearTimeout(this.loginAlertTimer);
      this.loginAlertTimer = null;
    }
  }

  private loadCardsForUser(userId: string): void {
    this.walletLoadError = '';
    this.cardsService.getWallet(userId).subscribe({
      next: (wallet) => {
        this.cardsByType = wallet;
        if (this.activeCardSlide >= this.activeCards.length && this.activeCards.length > 0) {
          this.activeCardSlide = this.activeCards.length - 1;
        }
        this.syncSelectedCard();
        this.loadOverallInsight(userId);
        this.reloadCardActivity();
      },
      error: () => {
        this.cardsByType = { prepaid: [], cashcard: [], others: [] };
        this.walletLoadError =
          'Could not load your cards. Restart with npm start or ionic serve so the backend runs on port 3000.';
        this.clearCardActivity();
      },
    });
  }

  private syncSelectedCard(): void {
    this.topUpError = '';
    this.cardContext.selectCard(this.currentCard);
    if (this.currentCard) {
      this.maybeClearLowBalanceDismiss(this.currentCard);
    }
  }

  private reloadCardActivity(): void {
    this.syncSelectedCard();
    this.clearCardActivity();
    this.loadCardActivity(this.auth.userId ?? 'user_1');
  }

  private loadOverallInsight(userId: string): void {
    this.insightLoadError = '';

    this.transactionsService
      .getInsights(userId, this.transactionsService.currentMonth, this.transactionsService.currentYear)
      .subscribe({
        next: (response) => {
          this.dnaTraits = response.traits ?? [];

          const teaser = response.smartInsights[0];
          if (teaser) {
            this.insight = { title: teaser.title, message: teaser.message };
            this.insightStyle = {
              icon: teaser.icon,
              color: teaser.color,
              bg: teaser.bg,
            };
            return;
          }

          this.insight = {
            title: 'Start spending to unlock insights',
            message: 'Pay, top up, or scan receipts — your insights will appear here.',
          };
          this.insightStyle = { icon: 'sparkles', color: '#6c63ff', bg: '#ede7f6' };
        },
        error: () => {
          this.insightLoadError = 'Could not load insights.';
          this.dnaTraits = [];
          this.insight = {
            title: 'Insights unavailable',
            message: 'Start the backend and refresh to see personalized spending insights.',
          };
          this.insightStyle = { icon: 'warning', color: '#eb5757', bg: '#fdecea' };
        },
      });
  }

  private loadCardActivity(userId: string): void {
    const card = this.currentCard;
    if (!card) {
      this.clearCardActivity();
      return;
    }

    const cardQuery = this.buildCardQuery(card);
    if (!cardQuery.cardId && !cardQuery.cardNumber) {
      this.clearCardActivity();
      return;
    }

    const requestId = ++this.cardActivityRequestId;

    this.transactionsService.getDashboard(userId, {
      ...cardQuery,
      period: this.spendingPeriodKey,
    }).subscribe({
      next: (dashboard) => {
        if (requestId !== this.cardActivityRequestId) {
          return;
        }

        this.monthlySummary = dashboard.monthlySummary;
        this.spendingCategories = dashboard.spendingCategories;
        this.recentTransactions = dashboard.recentTransactions.map((txn) => ({
          merchant: txn.merchant,
          subtitle: formatTransactionMeta(txn),
          amount: txn.amount,
          date: txn.date,
          time: txn.time,
          icon: txn.icon,
          iconColor: txn.iconColor,
          type: txn.type,
        }));
      },
      error: () => {
        if (requestId !== this.cardActivityRequestId) {
          return;
        }
        this.clearCardActivity();
      },
    });
  }

  private buildCardQuery(card: WalletCard): { cardId?: string; cardNumber?: string } {
    const cardId = card.id || this.findCardIdByNumber(card.cardNumber);
    return {
      cardId,
      cardNumber: card.cardNumber,
    };
  }

  private findCardIdByNumber(cardNumber: string): string | undefined {
    const digits = cardNumber.replace(/\D/g, '');
    if (!digits) {
      return undefined;
    }

    for (const type of ['prepaid', 'cashcard', 'others'] as CardType[]) {
      const match = this.cardsByType[type].find(
        (entry) => entry.cardNumber.replace(/\D/g, '') === digits
      );
      if (match?.id) {
        return match.id;
      }
    }

    return undefined;
  }

  private clearCardActivity(): void {
    this.monthlySummary = {
      month: 'June 2026',
      totalIn: 0,
      totalInChange: 0,
      totalSpent: 0,
      totalSpentChange: 0,
    };
    this.spendingCategories = [];
    this.recentTransactions = [];
  }

  private updateWalletCard(updatedCard: WalletCard): void {
    const type = updatedCard.cardType;
    this.cardsByType[type] = this.cardsByType[type].map((card) =>
      card.id === updatedCard.id ? { ...updatedCard } : card
    );
    this.maybeClearLowBalanceDismiss(updatedCard);
  }

  private maybeClearLowBalanceDismiss(card: WalletCard): void {
    const userId = this.auth.userId;
    if (!userId || !card.id) {
      return;
    }
    if (getCardFundsAmount(card) >= LOW_BALANCE_THRESHOLD) {
      clearLowBalanceDismiss(userId, card.id);
    }
  }

  private formatCardNumber(digits: string): string {
    const clean = digits.replace(/\s/g, '').slice(0, 16);
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`;
  }
}
