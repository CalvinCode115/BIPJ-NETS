import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AuthService } from '../../../../services/auth.service';
import { WalletCard, formatCardPaymentLabel } from '../../../../services/cards.service';
import { displayedCardBalance as formatDisplayedCardBalance } from '../../../../utils/card-display';
import { sanitizeIntegerAmountInput } from '../../../../utils/amount-input';
import { applySanitizedIonInput } from '../../../../utils/input-validation';
import { TopUpFundingOption } from '../../../../utils/wallet-topup';
import { CardsByTypeMap, HomeActivityService } from '../../services/home-activity.service';
import { HomeTopUpService } from '../../services/home-top-up.service';

export interface HomeTopUpCompletedEvent {
  card: WalletCard;
  sourceCard?: WalletCard;
  message: string;
}

@Component({
  selector: 'app-home-top-up-modal',
  templateUrl: './home-top-up-modal.component.html',
  styleUrls: ['./home-top-up-modal.component.scss'],
  standalone: false,
})
export class HomeTopUpModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() card: WalletCard | null = null;
  @Input() cardsByType: CardsByTypeMap = {
    prepaid: [],
    cashcard: [],
    others: [],
  };

  @Output() dismissed = new EventEmitter<void>();
  @Output() completed = new EventEmitter<HomeTopUpCompletedEvent>();
  @Output() requestAddCard = new EventEmitter<void>();

  topUpError = '';
  isToppingUp = false;
  topUpAmount = 10;
  topUpAmountText = '10';
  selectedTopUpFundingId = '';
  topUpFundingOptions: TopUpFundingOption[] = [];
  readonly quickTopUpAmounts = [10, 20, 50, 100, 200, 500];

  constructor(
    private auth: AuthService,
    private homeTopUp: HomeTopUpService,
    private homeActivity: HomeActivityService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      if (!this.card) {
        this.requestAddCard.emit();
        return;
      }
      this.topUpError = '';
      this.isToppingUp = false;
      this.topUpAmount = 10;
      this.topUpAmountText = '10';
      this.buildFundingOptions();
    }
  }

  get displayedTopUpCardRef(): string {
    return this.card ? formatCardPaymentLabel(this.card) : '';
  }

  get displayedTopUpBalance(): string {
    return formatDisplayedCardBalance(this.card, true);
  }

  get topUpButtonLabel(): string {
    const amount = this.topUpAmount.toFixed(2).replace(/\.?0+$/, '');
    return `Top Up $${amount}`;
  }

  close(): void {
    this.dismissed.emit();
  }

  selectTopUpAmount(amount: number): void {
    this.topUpAmount = amount;
    this.topUpAmountText = String(amount);
    this.topUpError = '';
  }

  onTopUpAmountInput(event: CustomEvent): void {
    const raw = String(event.detail.value ?? '');
    if (/[.,]/.test(raw)) {
      applySanitizedIonInput(event, this.topUpAmountText);
      this.topUpError = 'Enter a whole-dollar amount.';
      return;
    }
    const { text, amount } = sanitizeIntegerAmountInput(raw);
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

    const prepared = this.homeTopUp.prepareTopUp({
      userId: this.auth.userId,
      card: this.card,
      cardsByType: this.cardsByType,
      amount: this.topUpAmount,
      selectedFundingId: this.selectedTopUpFundingId,
      fundingOptions: this.topUpFundingOptions,
      resolveCardId: (card) => this.homeActivity.buildCardQuery(card, this.cardsByType).cardId,
    });

    if (!prepared.ok) {
      this.topUpError = prepared.error;
      return;
    }

    const userId = this.auth.userId;
    if (!userId) {
      this.topUpError = 'Please log in and select a card to top up.';
      return;
    }

    this.isToppingUp = true;

    this.homeTopUp.submitTopUp(userId, prepared.cardId, this.topUpAmount, prepared.funding).subscribe({
      next: (response) => {
        this.isToppingUp = false;
        this.topUpError = '';
        this.completed.emit({
          card: response.card,
          sourceCard: response.sourceCard,
          message: response.message,
        });
      },
      error: (err) => {
        this.isToppingUp = false;
        this.topUpError =
          err.error?.error ?? 'Unable to top up. Make sure the backend is running on port 3000.';
      },
    });
  }

  private buildFundingOptions(): void {
    const options = this.homeTopUp.buildFundingOptions(this.cardsByType);
    this.topUpFundingOptions = options;
    this.selectedTopUpFundingId = options[0]?.id ?? '';
  }
}
