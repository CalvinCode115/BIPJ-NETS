import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TravelService } from './travel.service';
import { FxTrackerService } from '../fx-tracker/fx-tracker.service';
import { AuthService } from '../services/auth.service';
import { CardContextService } from '../services/card-context.service';
import {
  CardsService,
  WalletCard,
  getCardThemeClass,
  getCardBrandBadge,
  getCardFundsLabel,
  getCardFundsAmount,
  getCardFundsSubtext,
  formatCardPaymentLabel,
} from '../services/cards.service';
import {
  displayedCardBalance as formatDisplayedCardBalance,
  displayedCardNumber as formatDisplayedCardNumber,
} from '../utils/card-display';
import { sanitizeDecimalAmountInput } from '../utils/amount-input';
import {
  RecommendationCard,
  CategorySection,
  BudgetTracker,
  FxInsight,
  TravelTransaction,
} from './travel.model';

@Component({
  selector: 'app-travel',
  templateUrl: './travel.page.html',
  styleUrls: ['./travel.page.scss'],
  standalone: false
})
export class TravelPage implements OnInit {
  // Travel
  recommendations: RecommendationCard[] = [];
  categories: CategorySection[] = [];
  isLoading = false;
  error: string | null = null;
  userId = 'user_1';
  destination = 'Johor Bahru, Malaysia';

  // Weather
  weather: any = null;

  // Budget
  budget: BudgetTracker | null = null;
  transactions: TravelTransaction[] = [];

  // FX FAB
  fxInsight: FxInsight | null = null;
  // Payment Modal
  isPaymentModalOpen = false;
  selectedVenue: RecommendationCard | null = null;
  activeCard: WalletCard | null = null;
  paymentAmount = 0;
  paymentAmountText = '';
  isPaying = false;
  quickPayAmounts = [10, 25, 50];

  constructor(
    private travelService: TravelService,
    private fxService: FxTrackerService,
    private router: Router,
    private auth: AuthService,
    private cardContext: CardContextService,
    private cardsService: CardsService
  ) { }

  ngOnInit() {
    this.loadAll();
    this.loadBudget();
    this.loadActiveCard();
  }

  loadAll() {
    this.loadTravelData();
    this.loadWeather();
    this.loadFxCircle();
  }

  // ========== TRAVEL DATA ==========

  loadTravelData() {
    this.isLoading = true;
    this.error = null;
    const now = new Date();

    this.travelService.getTravelRecommendations(this.userId, now.getMonth() + 1, now.getFullYear())
      .subscribe({
        next: (result: any) => {
          console.log('=== CATEGORY DEBUG ===');
          (result.categories || []).forEach((cat: any) => {
            console.log(`${cat.title}: ${cat.cards?.length || 0} cards`);
          });
          console.log('=====================');
          this.recommendations = result.recommendations || result.dnaPicks || [];
          // In the subscribe next block, when setting categories:
          this.categories = (result.categories || []).map((cat: CategorySection) => ({
            ...cat,
            visibleCount: 3
          }));
          if (result.budget && !this.budget) {
            this.budget = result.budget;
            this.saveBudget();
          }
          this.isLoading = false;
        },
        error: (err: any) => {
          this.error = err.message || 'Something went wrong';
          this.isLoading = false;
        }
      });
  }

  // ========== WEATHER ==========

  loadWeather() {
    const conditions = [
      { condition: 'Sunny', icon: 'sunny', temp: 32, humidity: 75 },
      { condition: 'Partly Cloudy', icon: 'partly-sunny', temp: 30, humidity: 80 },
      { condition: 'Cloudy', icon: 'cloudy', temp: 29, humidity: 82 },
      { condition: 'Rainy', icon: 'rainy', temp: 27, humidity: 90 },
    ];
    this.weather = conditions[Math.floor(Math.random() * conditions.length)];
  }

  getWeatherIcon(): string {
    const map: { [key: string]: string } = {
      sunny: 'sunny',
      cloudy: 'cloudy',
      rainy: 'rainy',
      thunderstorm: 'thunderstorm',
      'partly-sunny': 'partly-sunny',
    };
    return map[this.weather?.icon || ''] || 'sunny';
  }

  // ========== FX FAB ==========

  loadFxCircle() {
    this.fxService.getFxInsight(7).subscribe({
      next: (insight: FxInsight) => (this.fxInsight = insight),
      error: (err: any) => console.error('FX circle load failed:', err),
    });
  }

  goToFxTracker() {
    this.router.navigate(['/tabs/fx-tracker']);
  }

  getFxTrendColor(): string {
    if (!this.fxInsight) return '#8e8e93';
    if (this.fxInsight.trend === 'up') return '#d71920';
    if (this.fxInsight.trend === 'down') return '#34c759';
    return '#ff9500';
  }

  getFxTrendIcon(): string {
    if (!this.fxInsight) return 'remove-outline';
    if (this.fxInsight.trend === 'up') return 'trending-up-outline';
    if (this.fxInsight.trend === 'down') return 'trending-down-outline';
    return 'remove-outline';
  }

  // ========== BUDGET & PAYMENTS ==========

  loadBudget() {
    const saved = localStorage.getItem(`nets_travel_budget_${this.userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.budget = parsed.budget;
        this.transactions = parsed.transactions || [];
      } catch {
        this.initBudget();
      }
    } else {
      this.initBudget();
    }
  }

  initBudget() {
    this.budget = {
      spentSoFar: 0,
      typicalTripSpend: 500,
      remaining: 500,
      percentage: 0,
    };
    this.saveBudget();
  }

  saveBudget() {
    localStorage.setItem(
      `nets_travel_budget_${this.userId}`,
      JSON.stringify({
        budget: this.budget,
        transactions: this.transactions,
      })
    );
  }

  getBudgetColor(): string {
    if (!this.budget) return '#34c759';
    if (this.budget.percentage > 80) return '#d71920';
    if (this.budget.percentage > 60) return '#ff9500';
    return '#34c759';
  }

  // ========== PAYMENT MODAL ==========

  loadActiveCard() {
    const userId = this.auth.userId || this.userId;
    const selected = this.cardContext.getSelectedCard();

    this.cardsService.getWallet(userId).subscribe({
      next: (wallet: any) => {
        const fallback = wallet.prepaid[0] ?? wallet.cashcard[0] ?? wallet.others[0] ?? null;
        this.activeCard = selected || fallback;
        if (this.activeCard) {
          this.cardContext.selectCard(this.activeCard);
        }
      },
      error: () => {
        this.activeCard = selected;
      },
    });
  }

  openPaymentModal(venue: RecommendationCard) {
    this.selectedVenue = venue;
    this.paymentAmount = this.estimateAmount(venue.priceLevel);
    this.paymentAmountText = this.paymentAmount > 0 ? String(this.paymentAmount) : '';
    this.isPaymentModalOpen = true;
  }

  closePaymentModal() {
    this.isPaymentModalOpen = false;
    this.selectedVenue = null;
    this.paymentAmount = 0;
    this.paymentAmountText = '';
    this.isPaying = false;
  }

  estimateAmount(priceLevel?: number): number {
    if (!priceLevel) return 25;
    if (priceLevel === 1) return 10;
    if (priceLevel === 2) return 25;
    if (priceLevel === 3) return 50;
    return 75;
  }

  selectPaymentAmount(amount: number) {
    this.paymentAmount = amount;
    this.paymentAmountText = String(amount);
  }

  onPaymentAmountInput(event: any) {
    const { text, amount } = sanitizeDecimalAmountInput(String(event.detail.value ?? ''));
    this.paymentAmountText = text;
    this.paymentAmount = amount;
  }

  confirmPayment() {
    if (!this.budget || !this.selectedVenue || this.paymentAmount < 0.01) return;

    this.isPaying = true;

    setTimeout(() => {
      this.budget!.spentSoFar += this.paymentAmount;
      this.budget!.remaining = Math.max(0, this.budget!.typicalTripSpend - this.budget!.spentSoFar);
      this.budget!.percentage = Math.min(
        100,
        (this.budget!.spentSoFar / this.budget!.typicalTripSpend) * 100
      );

      this.transactions.unshift({
        id: Date.now().toString(),
        venueName: this.selectedVenue!.venueName,
        amount: this.paymentAmount,
        timestamp: new Date().toISOString(),
        cardLabel: this.activeCard ? formatCardPaymentLabel(this.activeCard) : 'NETS Card',
      });

      if (this.transactions.length > 5) {
        this.transactions = this.transactions.slice(0, 5);
      }

      this.saveBudget();
      this.isPaying = false;
      this.closePaymentModal();
    }, 800);
  }

  // ========== CARD DISPLAY HELPERS ==========

  get cardThemeClass(): string {
    return getCardThemeClass(this.activeCard);
  }

  get cardBrandBadge(): string {
    return getCardBrandBadge(this.activeCard);
  }

  get cardFundsLabel(): string {
    return getCardFundsLabel(this.activeCard);
  }

  get displayedCardBalance(): string {
    return formatDisplayedCardBalance(this.activeCard, true);
  }

  get cardDisplayNumber(): string {
    return formatDisplayedCardNumber(this.activeCard, true);
  }

  get showCardFundsSubtext(): boolean {
    return Boolean(getCardFundsSubtext(this.activeCard));
  }

  get cardFundsSubtext(): string | null {
    return getCardFundsSubtext(this.activeCard);
  }

  // ========== HELPERS ==========

  refresh() {
    this.loadAll();
    this.loadBudget();
    this.loadActiveCard();
  }

  getPriceLevel(level: number): string {
    if (!level) return '';
    return '💰'.repeat(Math.min(level, 4));
  }

  getStars(rating: number): string {
    if (!rating) return '';
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '');
  }

  openInMaps(card: RecommendationCard) {
    const query = encodeURIComponent(`${card.venueName}, ${card.address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  }

  formatTimeAgo(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  loadMoreCards(category: CategorySection) {
    category.visibleCount += 3;
  }
}