import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { AuthService } from '../../../../services/auth.service';
import {
  AccountKind,
  CardsService,
  CardType,
  LINKABLE_BANKS,
  WalletCard,
} from '../../../../services/cards.service';
import { applySanitizedIonInput, sanitizeCvvInput, sanitizeExpiryInput } from '../../../../utils/input-validation';

interface PrepaidCardForm {
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
}

export interface HomeCardLinkedEvent {
  card: WalletCard;
  cardType: CardType;
}

@Component({
  selector: 'app-home-add-card-modal',
  templateUrl: './home-add-card-modal.component.html',
  styleUrls: ['./home-add-card-modal.component.scss'],
  standalone: false,
})
export class HomeAddCardModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() activeAccountTab: CardType = 'prepaid';

  @Output() dismissed = new EventEmitter<void>();
  @Output() cardLinked = new EventEmitter<HomeCardLinkedEvent>();

  formError = '';
  isLinkingCard = false;
  isGeneratingCardNumber = false;
  linkBankName = 'DBS';
  linkAccountKind: AccountKind = 'debit';
  linkDefaultReceive = true;
  readonly linkBankOptions = LINKABLE_BANKS;
  selectedLinkCardType: CardType | null = null;

  newCardForm: PrepaidCardForm = {
    cardNumber: '',
    cardholderName: '',
    expiryDate: '',
    cvv: '',
  };

  constructor(
    private auth: AuthService,
    private cardsService: CardsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.resetState();
    }
  }

  get addCardModalTitle(): string {
    const titles: Record<CardType, string> = {
      prepaid: 'Add PREPAID Card',
      cashcard: 'Add CashCard',
      others: 'Link Bank Card',
    };
    return titles[this.activeAccountTab];
  }

  get showBankCardFields(): boolean {
    return this.activeAccountTab === 'others' || this.selectedLinkCardType === 'others';
  }

  get showCardholderField(): boolean {
    return this.showBankCardFields;
  }

  get balanceLookupNotice(): string {
    if (this.showBankCardFields) {
      return 'Enter any 16-digit card not already linked. Debit and credit balances are simulated for this demo.';
    }
    return 'Enter an unused 16-digit card number, or use Generate to create a valid demo number.';
  }

  close(): void {
    this.dismissed.emit();
  }

  selectLinkAccountKind(kind: AccountKind): void {
    this.linkAccountKind = kind;
    if (kind === 'credit') {
      this.linkDefaultReceive = false;
    }
  }

  generateCardNumber(): void {
    const userId = this.auth.userId;
    const cardType = this.activeAccountTab;
    if (!userId || (cardType !== 'prepaid' && cardType !== 'cashcard')) {
      this.formError = 'Please log in and select Prepaid or CashCard.';
      return;
    }

    this.formError = '';
    this.isGeneratingCardNumber = true;
    this.cardsService.generateCardNumber(userId, cardType).subscribe({
      next: (response) => {
        this.newCardForm.cardNumber = response.cardNumber;
        this.isGeneratingCardNumber = false;
      },
      error: (err) => {
        this.isGeneratingCardNumber = false;
        this.formError =
          err.error?.error ?? 'Unable to generate a card number. Make sure the backend is running on port 3000.';
      },
    });
  }

  addCard(): void {
    this.formError = '';
    const userId = this.auth.userId;
    if (!userId) {
      this.formError = 'Please log in to link a card.';
      return;
    }

    const linkCardType = this.selectedLinkCardType ?? this.activeAccountTab;
    const digits = this.newCardForm.cardNumber.replace(/\s/g, '');
    const name = this.newCardForm.cardholderName.trim();
    const expiry = this.newCardForm.expiryDate.trim();
    const cvv = this.newCardForm.cvv.trim();

    if (digits.length !== 16 || !/^\d+$/.test(digits)) {
      this.formError = 'Enter a valid 16-digit card number.';
      return;
    }

    if (this.showCardholderField) {
      if (name.length < 2 || name.length > 26 || !/^[A-Z]+(?: [A-Z]+)*$/.test(name)) {
        this.formError =
          'Cardholder name must be between 2 and 26 characters using letters only.';
        return;
      }
    }

    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      this.formError = 'Expiry must be in MM/YY format.';
      return;
    }

    if (!this.isExpiryAfterCurrentMonth(expiry)) {
      this.formError = 'Expiry must the current month or later.';
      return;
    }

    if (!/^\d{3}$/.test(cvv)) {
      this.formError = 'CVV must be exactly 3 digits.';
      return;
    }

    this.isLinkingCard = true;
    this.cardsService
      .linkCard(userId, {
        cardType: linkCardType,
        cardNumber: digits,
        cardholderName: this.showCardholderField ? name : undefined,
        expiryDate: expiry,
        cvv,
        bankName: this.showCardholderField ? this.linkBankName : undefined,
        accountKind: this.showCardholderField ? this.linkAccountKind : undefined,
        isDefaultReceive:
          this.showCardholderField && this.linkAccountKind === 'debit'
            ? this.linkDefaultReceive
            : undefined,
      })
      .subscribe({
        next: (response) => {
          this.isLinkingCard = false;
          this.cardLinked.emit({ card: response.card, cardType: linkCardType });
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
    applySanitizedIonInput(event, this.newCardForm.cardNumber);
  }

  onCardholderNameInput(event: CustomEvent): void {
    const value = String(event.detail.value ?? '');
    const cleaned = value
      .replace(/[^a-zA-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 26);

    this.newCardForm.cardholderName = cleaned.toUpperCase();
    applySanitizedIonInput(event, this.newCardForm.cardholderName);
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

  private resetState(): void {
    this.formError = '';
    this.selectedLinkCardType = null;
    this.linkBankName = 'DBS';
    this.linkAccountKind = 'debit';
    this.linkDefaultReceive = true;
    this.isGeneratingCardNumber = false;
    this.isLinkingCard = false;
    this.newCardForm = {
      cardNumber: '',
      cardholderName: '',
      expiryDate: '',
      cvv: '',
    };
  }

  private isExpiryAfterCurrentMonth(expiry: string): boolean {
    const [monthPart, yearPart] = expiry.split('/');
    const month = parseInt(monthPart, 10);
    const year = parseInt(yearPart, 10);

    const now = new Date();
    const minYear = now.getFullYear() % 100;
    const minMonth = now.getMonth() + 1;

    if (year > minYear) return true;
    if (year === minYear && month >= minMonth) return true;
    return false;
  }

  private formatCardNumber(digits: string): string {
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }
}
