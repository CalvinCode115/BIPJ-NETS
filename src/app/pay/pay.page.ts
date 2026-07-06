import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CardContextService } from '../services/card-context.service';
import {
  CardsByType,
  CardsService,
  formatCardFundsLabel,
  formatCardPaymentLabel,
  getCardBrandBadge,
  getCardFundsAmount,
  getCardFundsLabel,
  getCardFundsSubtext,
  getCardThemeClass,
  TopUpMethod,
  WalletCard,
} from '../services/cards.service';
import { SavedContact, SavedContactsService } from '../services/saved-contacts.service';
import { TransferRecipient, TransfersService } from '../services/transfers.service';
import { sanitizeDecimalAmountInput } from '../utils/amount-input';
import { applySanitizedIonInput, NAME_PATTERN, sanitizeNameInput, sanitizePhoneDigits } from '../utils/input-validation';
import {
  displayedCardBalance as formatDisplayedCardBalance,
  displayedCardFundsLabel as formatDisplayedCardFundsLabel,
  displayedCardNumber as formatDisplayedCardNumber,
} from '../utils/card-display';
import { buildTopUpFundingOptions, canManualTopUpWalletCard, isAutoTopUpEnabled, LOW_BALANCE_THRESHOLD, manualTopUpDisabledReason as walletTopUpReason, TopUpFundingOption } from '../utils/wallet-topup';
import { shortReceiveLabel } from '../utils/display-name';
import { formatCounterpartyLine } from '../utils/transfer-display';

interface QuickPayOption {
  title: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  action?: 'scan' | 'paynow';
}

type TransferMode = 'phone' | 'saved';
type ContactFormMode = 'add' | 'edit';

@Component({
  selector: 'app-pay',
  templateUrl: 'pay.page.html',
  styleUrls: ['pay.page.scss'],
  standalone: false,
})
export class PayPage {
  activeCard: WalletCard | null = null;
  cardsByType: CardsByType = { prepaid: [], cashcard: [], others: [] };

  isTransferModalOpen = false;
  isContactModalOpen = false;
  isTopUpModalOpen = false;
  contactFormMode: ContactFormMode = 'add';
  editingContactId = '';
  transferMode: TransferMode = 'phone';
  transferPhoneDigits = '';
  transferAmount = 0;
  transferAmountText = '';
  transferError = '';
  transferSuccess = '';
  isTransferring = false;
  isLookingUp = false;
  transferRecipient: TransferRecipient | null = null;
  transferReceiveLabel = '';

  topUpError = '';
  topUpSuccess = '';
  private topUpSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  isToppingUp = false;
  topUpAmount = 10;
  topUpAmountText = '10';
  selectedTopUpFundingId = '';
  topUpFundingOptions: TopUpFundingOption[] = [];
  readonly quickTopUpAmounts = [10, 20, 50, 100, 200, 500];

  savedContacts: SavedContact[] = [];
  contactName = '';
  contactDigits = '';
  contactFormError = '';

  readonly formatCardPaymentLabel = formatCardPaymentLabel;
  readonly formatCardFundsLabel = formatCardFundsLabel;

  constructor(
    private router: Router,
    private auth: AuthService,
    private cardsService: CardsService,
    private cardContext: CardContextService,
    private transfersService: TransfersService,
    private savedContactsService: SavedContactsService
  ) {}

  ionViewWillEnter(): void {
    this.loadActiveCard();
    this.loadSavedContacts();
  }

  ionViewWillLeave(): void {
    this.clearTopUpSuccessTimer();
  }

  quickPayOptions: QuickPayOption[] = [
    {
      title: 'Scan QR',
      subtitle: 'Pay or scan receipt',
      icon: 'qr-code',
      iconColor: '#2f80ed',
      iconBg: '#e3f2fd',
      action: 'scan',
    },
    {
      title: 'Mobile Number',
      subtitle: 'PayNow transfer',
      icon: 'phone-portrait',
      iconColor: '#eb5757',
      iconBg: '#fdecea',
      action: 'paynow',
    },
  ];

  get cardThemeClass(): string {
    return getCardThemeClass(this.activeCard);
  }

  get cardBrandBadge(): string {
    return getCardBrandBadge(this.activeCard);
  }

  get cardFundsLabel(): string {
    return getCardFundsLabel(this.activeCard);
  }

  get cardFundsAmount(): number {
    return getCardFundsAmount(this.activeCard);
  }

  get cardFundsSubtext(): string | null {
    return getCardFundsSubtext(this.activeCard);
  }

  get cardDisplayNumber(): string {
    return formatDisplayedCardNumber(this.activeCard, this.showCardSensitiveDetails);
  }

  get showCardSensitiveDetails(): boolean {
    return this.cardContext.getShowSensitiveDetails();
  }

  get displayedCardBalance(): string {
    return formatDisplayedCardBalance(this.activeCard, this.showCardSensitiveDetails);
  }

  get displayedPayFromLabel(): string {
    return this.activeCard ? formatCardPaymentLabel(this.activeCard) : '';
  }

  get displayedPayFromFunds(): string {
    return this.activeCard ? formatCardFundsLabel(this.activeCard) : '';
  }

  get displayedBalanceAfterTransfer(): string {
    if (!this.activeCard) {
      return '';
    }
    const remaining = this.balanceAfterTransferAmount;
    return `$${Math.max(0, remaining).toFixed(2)}`;
  }

  get balanceAfterTransferAmount(): number {
    if (!this.activeCard) {
      return 0;
    }
    return getCardFundsAmount(this.activeCard) - this.transferAmount;
  }

  get balanceAfterTransferTone(): 'muted' | 'warning' | 'danger' {
    if (!this.activeCard || this.transferAmount < 0.01) {
      return 'muted';
    }
    const available = getCardFundsAmount(this.activeCard);
    if (this.balanceAfterTransferAmount < 0 || this.transferAmount > available) {
      return 'danger';
    }
    if (canManualTopUpWalletCard(this.activeCard) && this.balanceAfterTransferAmount < LOW_BALANCE_THRESHOLD) {
      return 'warning';
    }
    return 'muted';
  }

  get displayedTopUpBalance(): string {
    return formatDisplayedCardBalance(this.activeCard, true);
  }

  get showCardFundsSubtext(): boolean {
    return this.showCardSensitiveDetails && Boolean(this.cardFundsSubtext);
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

  get payingFromLabel(): string {
    if (!this.activeCard) {
      return '';
    }
    return formatCardPaymentLabel(this.activeCard);
  }

  get canTopUpCard(): boolean {
    return canManualTopUpWalletCard(this.activeCard);
  }

  get canPayOthers(): boolean {
    return Boolean(this.activeCard && this.activeCard.cardType !== 'cashcard');
  }

  get topUpDisabledReason(): string {
    if (!this.activeCard) {
      return 'Select a prepaid or CashCard on Home to top up.';
    }
    return walletTopUpReason(this.activeCard);
  }

  get topUpButtonLabel(): string {
    const amount = this.topUpAmount.toFixed(2).replace(/\.?0+$/, '');
    return `Top Up $${amount}`;
  }

  get recipientSummaryLine(): string {
    if (!this.transferRecipient) {
      return '';
    }

    return formatCounterpartyLine(
      'to',
      this.transferRecipient.name,
      this.transferRecipient.phone ?? this.savedContactsService.formatPhone(this.transferPhoneDigits)
    );
  }

  get contactModalTitle(): string {
    return this.contactFormMode === 'edit' ? 'Edit Contact' : 'Save Contact';
  }

  get contactSubmitLabel(): string {
    return this.contactFormMode === 'edit' ? 'Update Contact' : 'Save Contact';
  }

  get shortReceiveLabel(): string {
    return shortReceiveLabel(this.transferReceiveLabel);
  }

  goToHomeForCard(): void {
    this.router.navigate(['/tabs/home']);
  }

  onQuickPayClick(option: QuickPayOption): void {
    if (option.action === 'scan') {
      this.router.navigate(['/tabs/home/home-qr-code'], { queryParams: { tab: 'scan' } });
      return;
    }

    if (option.action === 'paynow') {
      this.openTransferModal();
    }
  }

  openTopUpModal(): void {
    if (!this.activeCard) {
      this.topUpError = 'Select a prepaid or CashCard on Home to top up.';
      return;
    }

    if (!this.canTopUpCard) {
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

    const card = this.activeCard;
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
      this.topUpError = 'Unable to identify this card. Refresh and try again.';
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
          this.activeCard = response.card;
          this.cardContext.selectCard(response.card);
          this.isToppingUp = false;
          this.showTopUpSuccess(response.message);
          this.topUpError = '';
          this.closeTopUpModal();
        },
        error: (err: { error?: { error?: string } }) => {
          this.isToppingUp = false;
          this.topUpError =
            err?.error?.error ?? 'Unable to top up. Make sure the backend is running on port 3000.';
        },
      });
  }

  openTransferModal(): void {
    if (!this.canPayOthers) {
      return;
    }
    this.resetTransferState();
    this.transferMode = 'phone';
    this.isTransferModalOpen = true;
  }

  openTransferFromContact(contact: SavedContact): void {
    if (!this.canPayOthers) {
      return;
    }
    this.resetTransferState();
    this.transferMode = 'saved';
    this.transferPhoneDigits = contact.phoneDigits;
    this.isTransferModalOpen = true;
    this.lookupRecipient();
  }

  openAddContactModal(): void {
    this.contactFormMode = 'add';
    this.editingContactId = '';
    this.resetContactForm();
    this.isContactModalOpen = true;
  }

  openEditContactModal(contact: SavedContact, event?: Event): void {
    event?.stopPropagation();
    this.contactFormMode = 'edit';
    this.editingContactId = contact.id;
    this.contactFormError = '';
    this.contactName = contact.name;
    this.contactDigits = contact.phoneDigits;
    this.isContactModalOpen = true;
  }

  closeContactModal(): void {
    this.isContactModalOpen = false;
    this.resetContactForm();
  }

  private resetContactForm(): void {
    this.contactFormError = '';
    this.contactName = '';
    this.contactDigits = '';
    this.editingContactId = '';
  }

  closeTransferModal(): void {
    this.isTransferModalOpen = false;
    this.transferError = '';
    this.isTransferring = false;
    this.isLookingUp = false;
  }

  onTransferPhoneInput(event: CustomEvent): void {
    const digits = sanitizePhoneDigits(String(event.detail.value ?? ''));
    this.transferPhoneDigits = digits;
    applySanitizedIonInput(event, digits);
    this.transferRecipient = null;
    this.transferReceiveLabel = '';
    this.transferError = '';

    if (this.transferPhoneDigits.length === 8) {
      this.lookupRecipient();
    }
  }

  onContactNameInput(event: CustomEvent): void {
    this.contactName = sanitizeNameInput(String(event.detail.value ?? ''));
    this.contactFormError = '';
  }

  onContactPhoneInput(event: CustomEvent): void {
    this.contactDigits = sanitizePhoneDigits(String(event.detail.value ?? ''));
    this.contactFormError = '';
  }

  onTransferAmountInput(event: CustomEvent): void {
    const { text, amount } = sanitizeDecimalAmountInput(String(event.detail.value ?? ''));
    this.transferAmountText = text;
    this.transferAmount = amount;
    applySanitizedIonInput(event, text);
    this.transferError = '';
  }

  get selectedPayCardId(): string {
    const card = this.activeCard;
    if (!card) {
      return '';
    }
    return card.id || this.findCardIdByNumber(card.cardNumber) || '';
  }

  lookupRecipient(): void {
    if (this.transferPhoneDigits.length !== 8) {
      this.transferError = 'Enter an 8-digit mobile number.';
      return;
    }

    const phone = this.savedContactsService.formatPhone(this.transferPhoneDigits);
    this.transferError = '';
    this.isLookingUp = true;

    this.transfersService.lookupUser(phone).subscribe({
      next: (response) => {
        this.isLookingUp = false;
        if (response.user.id === this.auth.userId) {
          this.transferError = 'You cannot transfer to yourself.';
          this.transferRecipient = null;
          this.transferReceiveLabel = '';
          return;
        }

        this.transferRecipient = response.user;
        this.transferReceiveLabel = response.receiveLabel ?? '';
      },
      error: (err: { error?: { error?: string } }) => {
        this.isLookingUp = false;
        this.transferRecipient = null;
        this.transferReceiveLabel = '';
        this.transferError = err?.error?.error ?? 'Recipient not found.';
      },
    });
  }

  saveContact(): void {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    const name = this.contactName.trim();
    if (name.length < 2) {
      this.contactFormError = 'Enter a contact name.';
      return;
    }

    if (!NAME_PATTERN.test(name)) {
      this.contactFormError = 'Name must contain letters only.';
      return;
    }

    if (this.contactDigits.length !== 8) {
      this.contactFormError = 'Enter an 8-digit mobile number.';
      return;
    }

    const duplicate = this.savedContacts.some(
      (contact) =>
        contact.phoneDigits === this.contactDigits && contact.id !== this.editingContactId
    );
    if (duplicate) {
      this.contactFormError = 'This mobile number is already saved.';
      return;
    }

    if (this.contactFormMode === 'edit' && this.editingContactId) {
      const updated = this.savedContactsService.updateContact(userId, this.editingContactId, {
        name,
        phoneDigits: this.contactDigits,
      });
      if (!updated) {
        this.contactFormError = 'Unable to update this contact.';
        return;
      }
    } else {
      this.savedContactsService.saveContact(userId, {
        name,
        phoneDigits: this.contactDigits,
        color: this.savedContactsService.nextColor(this.savedContacts),
      });
    }

    this.loadSavedContacts();
    this.closeContactModal();
  }

  deleteContact(): void {
    const userId = this.auth.userId;
    if (!userId || !this.editingContactId) {
      return;
    }

    this.savedContactsService.deleteContact(userId, this.editingContactId);
    this.loadSavedContacts();
    this.closeContactModal();
  }

  submitTransfer(): void {
    const userId = this.auth.userId;
    if (!userId || !this.selectedPayCardId) {
      return;
    }

    if (!this.transferRecipient) {
      this.transferError =
        this.transferMode === 'phone' ? 'Enter a valid mobile number.' : 'Recipient could not be verified.';
      return;
    }

    if (this.transferAmount < 0.01) {
      this.transferError = 'Enter an amount of at least $0.01.';
      return;
    }

    this.isTransferring = true;
    this.transferError = '';

    this.transfersService
      .transfer(userId, {
        toUserId: this.transferRecipient.id,
        amount: this.transferAmount,
        fromCardId: this.selectedPayCardId,
        channel: 'paynow',
      })
      .subscribe({
        next: (response) => {
          this.isTransferring = false;
          this.transferSuccess = response.message;
          this.loadActiveCard();
        },
        error: (err: { error?: { error?: string } }) => {
          this.isTransferring = false;
          this.transferError = err?.error?.error ?? 'Transfer failed.';
        },
      });
  }

  formatContactPhone(contact: SavedContact): string {
    return this.savedContactsService.formatPhone(contact.phoneDigits);
  }

  private loadSavedContacts(): void {
    const userId = this.auth.userId;
    if (!userId) {
      this.savedContacts = [];
      return;
    }

    this.savedContacts = this.savedContactsService.getContacts(userId);
  }

  private resetTransferState(): void {
    this.transferError = '';
    this.transferSuccess = '';
    this.transferAmount = 0;
    this.transferAmountText = '';
    this.transferRecipient = null;
    this.transferReceiveLabel = '';
    this.transferPhoneDigits = '';
    this.isLookingUp = false;
  }

  private loadActiveCard(): void {
    const userId = this.auth.userId ?? 'user_1';
    const selected = this.cardContext.getSelectedCard();

    this.cardsService.getWallet(userId).subscribe({
      next: (wallet) => {
        this.cardsByType = wallet;
        const refreshed = this.findCardInWallet(selected, wallet);
        const fallback = wallet.prepaid[0] ?? wallet.cashcard[0] ?? wallet.others[0] ?? null;
        this.activeCard = refreshed ?? fallback;

        if (this.activeCard) {
          this.cardContext.selectCard(this.activeCard);
        }
      },
      error: () => {
        this.activeCard = selected;
        this.cardsByType = { prepaid: [], cashcard: [], others: [] };
      },
    });
  }

  private findCardInWallet(card: WalletCard | null, wallet: CardsByType): WalletCard | null {
    if (!card) {
      return null;
    }

    if (card.id) {
      for (const type of ['prepaid', 'cashcard', 'others'] as const) {
        const match = wallet[type].find((entry) => entry.id === card.id);
        if (match) {
          return match;
        }
      }
    }

    const digits = card.cardNumber.replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    for (const type of ['prepaid', 'cashcard', 'others'] as const) {
      const match = wallet[type].find((entry) => entry.cardNumber.replace(/\D/g, '') === digits);
      if (match) {
        return match;
      }
    }

    return null;
  }

  private buildTopUpFundingOptions(): void {
    const options = buildTopUpFundingOptions(this.cardsByType);
    this.topUpFundingOptions = options;
    this.selectedTopUpFundingId = options[0]?.id ?? '';
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

  private updateWalletCard(updatedCard: WalletCard): void {
    const type = updatedCard.cardType;
    this.cardsByType[type] = this.cardsByType[type].map((card) =>
      card.id === updatedCard.id ? { ...updatedCard } : card
    );
  }

  private findCardIdByNumber(cardNumber: string): string | undefined {
    const digits = cardNumber.replace(/\D/g, '');
    if (!digits) {
      return undefined;
    }

    for (const type of ['prepaid', 'cashcard', 'others'] as const) {
      const match = this.cardsByType[type].find(
        (entry) => entry.cardNumber.replace(/\D/g, '') === digits
      );
      if (match?.id) {
        return match.id;
      }
    }

    return this.activeCard?.id;
  }
}
