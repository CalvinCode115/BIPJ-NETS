import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  WalletCard,
  getCardBrandBadge,
  getCardFundsAmount,
  getCardFundsLabel,
  getCardFundsSubtext,
  getCardThemeClass,
} from '../../../../services/cards.service';
import { CardContextService } from '../../../../services/card-context.service';
import {
  displayedCardBalance as formatDisplayedCardBalance,
  displayedCardExpiry as formatDisplayedCardExpiry,
  displayedCardNumber as formatDisplayedCardNumber,
} from '../../../../utils/card-display';

@Component({
  selector: 'app-home-card-carousel',
  templateUrl: './home-card-carousel.component.html',
  styleUrls: ['./home-card-carousel.component.scss'],
  standalone: false,
})
export class HomeCardCarouselComponent {
  @Input() card: WalletCard | null = null;
  @Input() activeSlide = 0;
  @Input() totalSlides = 1;
  @Input() slides: number[] | null = null;
  @Input() addSlideSubtitle = '';
  @Input() autoTopUpActive = false;

  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() goToSlide = new EventEmitter<number>();
  @Output() addCard = new EventEmitter<void>();
  @Output() toggleSensitive = new EventEmitter<void>();

  constructor(private cardContext: CardContextService) {}

  get cardSlides(): number[] {
    if (this.slides?.length) {
      return this.slides;
    }
    const count = Math.max(1, this.totalSlides);
    return Array.from({ length: count }, (_, index) => index);
  }

  get cardThemeClass(): string {
    return getCardThemeClass(this.card);
  }

  get cardBrandBadge(): string {
    return getCardBrandBadge(this.card);
  }

  get cardFundsLabel(): string {
    return getCardFundsLabel(this.card);
  }

  get cardFundsSubtext(): string | null {
    return getCardFundsSubtext(this.card);
  }

  get cardFundsAmount(): number {
    return getCardFundsAmount(this.card);
  }

  get showSensitiveDetails(): boolean {
    return this.cardContext.getShowSensitiveDetails();
  }

  get displayedCardBalance(): string {
    return formatDisplayedCardBalance(this.card, this.showSensitiveDetails);
  }

  get displayedCardNumber(): string {
    return formatDisplayedCardNumber(this.card, this.showSensitiveDetails);
  }

  get displayedCardExpiry(): string {
    return formatDisplayedCardExpiry(this.card?.expiryDate, this.showSensitiveDetails);
  }

  get showCardFundsSubtext(): boolean {
    return this.showSensitiveDetails && Boolean(this.cardFundsSubtext);
  }

  onPrev(): void {
    this.prev.emit();
  }

  onNext(): void {
    this.next.emit();
  }

  onGoToSlide(index: number): void {
    this.goToSlide.emit(index);
  }

  onAddCard(): void {
    this.addCard.emit();
  }

  onToggleSensitive(): void {
    this.toggleSensitive.emit();
  }
}
