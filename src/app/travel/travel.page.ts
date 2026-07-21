import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TravelService } from './travel.service';
import { FxTrackerService } from '../fx-tracker/fx-tracker.service';
import { AuthService } from '../services/auth.service';
import { CardContextService } from '../services/card-context.service';
import { GooglePlace } from './travel.model';
import { CountryDataService, CountryInfo } from '../services/country-data.service';
import { CountryGlobeComponent } from '../components/country-globe/country-globe.component';
import {
  CardsService,
  WalletCard,
  getCardThemeClass,
  getCardBrandBadge,
  getCardFundsLabel,
  getCardFundsAmount,
  getCardFundsSubtext,
  formatCardPaymentLabel,
  MultiCurrencyWallet,
} from '../services/cards.service';
import { DestinationConfig, DESTINATIONS, DEFAULT_DESTINATION } from '../services/destination.config';
import { CacheService } from '../services/cache.service';
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

import { PackingItem, WeatherService, DailyForecast } from './weather.service';
import { CardCurrencyBalance, CardLinkedExchangeService } from '../services/card-linked-exchange.service';
@Component({
  selector: 'app-travel',
  templateUrl: './travel.page.html',
  styleUrls: ['./travel.page.scss'],
  standalone: false
})
export class TravelPage implements OnInit {
  @ViewChild('tripToggle', { static: false }) tripToggle: any;

  // ── Country Selection ──
  currentDestination: DestinationConfig = DESTINATIONS[DEFAULT_DESTINATION];
  destinationDropdownOpen = false;
  readonly destinations = Object.values(DESTINATIONS);


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

  // Detail Modal
  isDetailModalOpen = false;
  selectedDetailCard: RecommendationCard | null = null;
  currentPhotoIndex = 0;

  // Trip Mode
  isTripMode = false;
  tripDay = 1;
  tripTotalDays = 4;
  tripStartDate: string | null = null;
  isTripLocked = false;
  currentTripCountry: string | null = null;
  readonly TRIP_LOCK_KEY = 'nets_trip_locked';
  readonly TRIP_COUNTRY_KEY = 'nets_trip_country';

  // DNA Profile
  dnaProfile: any = null;
  plannedVenues: RecommendationCard[] = [];

  // Simulator
  isSimulatorOpen = false;
  simulatorCategories: { name: string; key: string; current: number; adjusted: number; color: string }[] = [];

  // Post-Trip Report
  isReportOpen = false;
  tripReport: any = null;

  isConfirmingEndTrip = false;
  tripToEndSummary: any = null;

  simulatorPlan: { [key: string]: number } = {};
  categoryBudgets: { [key: string]: number } = {};

  isBudgetPickerOpen = false;
  budgetOptions = [200, 300, 400, 500, 600, 800, 1000];
  selectedBudgetOption = 500;
  customBudget = '';

  forecast: DailyForecast[] = [];
  packingList: PackingItem[] = [];
  itinerary: { day: DailyForecast; activities: any[] }[] = [];
  weatherSortedPlaces: any[] = [];
  activeDayIndex: number = 0;

  places: any[] = [];
  placesApiKey: string = '';

  multiCurrencyBalances: CardCurrencyBalance[] = [];
  paymentCurrency: string = 'SGD';
  paymentInForeignCurrency: boolean = false;

  tripDurationOptions = [1, 2, 3, 4, 5, 6, 7, 10, 14];
  selectedTripDuration = 4;
  constructor(
    private http: HttpClient,
    private travelService: TravelService,
    private fxService: FxTrackerService,
    private router: Router,
    private auth: AuthService,
    private cardContext: CardContextService,
    private cardsService: CardsService,
    public weatherService: WeatherService,
    private cache: CacheService,
    private modalCtrl: ModalController,
    private countryData: CountryDataService,
    public cardExchange: CardLinkedExchangeService,
  ) { }

  ngOnInit() {
    const savedDest = localStorage.getItem('nets_selected_destination');
    if (savedDest) {
      if (DESTINATIONS[savedDest]) {
        this.currentDestination = DESTINATIONS[savedDest];
      } else {
        // Try to parse as dynamic destination
        try {
          const parsed = JSON.parse(savedDest);
          if (parsed && parsed.id) {
            // Ensure fxPair is always an array (fix for legacy stored data)
            if (typeof parsed.fxPair === 'string') {
              parsed.fxPair = ['SGD', parsed.fxPair];
            } else if (!parsed.fxPair) {
              parsed.fxPair = ['SGD', parsed.currencyCode || 'USD'];
            }
            this.currentDestination = parsed;
          }
        } catch {
          // fallback to default
        }
      }
    }

    this.loadTripMode();
    this.migrateOldPlans();
    this.loadPlan();
    this.loadCategoryBudgets();
    this.loadAll();
    if (this.isTripMode) this.loadBudget();
    this.loadActiveCard();
    this.loadMultiCurrencyBalances();
    this.loadTripLockState();

    // Only load budget if in trip mode
    if (this.isTripMode) {
      this.loadBudget();
    }
  }

  loadAll() {
    this.loadTravelData();      // ← this now fetches places too
    this.loadWeather();
    this.loadFxCircle();
    this.loadForecastAndBuildItinerary();

    this.weatherService.getForecast(this.currentDestination).subscribe({
      next: (forecast) => {
        this.forecast = forecast;
        this.packingList = this.weatherService.getPackingList(forecast, this.currentDestination);
        // buildWeatherItinerary() is now called inside loadTravelData() when places arrive
      }
    });
  }


  // ========== TRAVEL DATA ==========
  // Update loadTravelData to call onPlacesLoaded
  loadTravelData() {
    this.isLoading = true;
    this.error = null;
    const now = new Date();

    this.travelService.getTravelRecommendations(
      this.userId,
      this.currentDestination,
      now.getMonth() + 1,
      now.getFullYear()
    ).subscribe({
      next: (result) => {
        this.recommendations = result.dnaPicks || [];
        this.categories = (result.categories || []).map((cat: CategorySection) => ({
          ...cat,
          visibleCount: 3
        }));
        this.places = result.places || [];

        if (result.budget && !this.budget) {
          this.budget = result.budget;
          this.saveBudget();
        }

        // ← KEY: trigger itinerary rebuild now that places are here
        this.onPlacesLoaded();

        this.isLoading = false;
      },
      error: (err: any) => {
        this.error = err.message || 'Something went wrong';
        this.isLoading = false;
      }
    });
  }


  loadMoreCards(category: CategorySection) {
    category.visibleCount += 3;
  }

  // ========== WEATHER ==========

  loadWeather() {
    this.weatherService.getWeather(this.currentDestination).subscribe({
      next: (weather) => {
        this.weather = weather;
      }
    });
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
    // Skip FX for exotic currencies that may not be supported
    const supportedFxCurrencies = ['MYR', 'THB', 'JPY', 'KRW', 'AUD', 'USD', 'EUR', 'GBP', 'SGD', 'CNY', 'IDR', 'PHP', 'VND', 'INR'];
    const currency = this.currentDestination?.currencyCode;

    if (currency && !supportedFxCurrencies.includes(currency)) {
      this.fxInsight = null;
      return;
    }

    this.fxService.getFxInsightWithPrediction(this.currentDestination, 7).subscribe({
      next: (insight) => this.fxInsight = insight,
      error: (err) => {
        console.error('FX load failed:', err);
        this.fxInsight = null;
      }
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

  // ========== CATEGORY INFERENCE ==========

  inferCategory(venueName: string): string {
    const n = venueName.toLowerCase();
    if (n.includes('cafe') || n.includes('kopitiam') || n.includes('restaurant') || n.includes('food') || n.includes('eats') || n.includes('dining') || n.includes('bakery') || n.includes('hawker') || n.includes('kitchen') || n.includes('noodle')) return 'food';
    if (n.includes('mall') || n.includes('shop') || n.includes('store') || n.includes('market') || n.includes('plaza') || n.includes('boutique') || n.includes('retail')) return 'shopping';
    if (n.includes('museum') || n.includes('park') || n.includes('temple') || n.includes('garden') || n.includes('attraction') || n.includes('zoo') || n.includes('gallery') || n.includes('theme') || n.includes('adventure') || n.includes('beach') || n.includes('landmark')) return 'activities';
    if (n.includes('bus') || n.includes('taxi') || n.includes('train') || n.includes('ferry') || n.includes('transport') || n.includes('mrt') || n.includes('rail') || n.includes('transit') || n.includes('terminal')) return 'transport';
    return 'food';
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

  // ========== DETAIL MODAL ==========

  openDetailModal(card: RecommendationCard) {
    this.selectedDetailCard = card;
    this.currentPhotoIndex = 0;
    this.isDetailModalOpen = true;
  }

  closeDetailModal() {
    this.isDetailModalOpen = false;
    this.selectedDetailCard = null;
    this.currentPhotoIndex = 0;
  }

  nextPhoto() {
    this.currentPhotoIndex++;
  }

  getOpeningHoursText(card: RecommendationCard): string {
    if (card.openNow) return 'Open now';
    return 'Check hours';
  }

  getSmartDistance(card: RecommendationCard): string {
    if (!card.distance) return '';
    if (card.distance < 1000) return `${Math.round(card.distance)}m away`;
    return `${(card.distance / 1000).toFixed(1)}km away`;
  }

  goToMapsFromDetail() {
    if (!this.selectedDetailCard) return;
    const cardToMap = this.selectedDetailCard;
    this.closeDetailModal();
    setTimeout(() => this.openInMaps(cardToMap), 300);
  }

  payFromDetail() {
    if (!this.selectedDetailCard) return;
    const cardToPay = this.selectedDetailCard;
    this.closeDetailModal();
    setTimeout(() => this.openPaymentModal(cardToPay), 300);
  }

  // ========== PLAN / TO-DO ==========
  addToPlan(card: RecommendationCard) {
    if (!this.plannedVenues.find(v => v.venueName === card.venueName)) {
      this.plannedVenues.push(card);
      this.savePlan();
    }
  }

  removeFromPlan(card: RecommendationCard) {
    this.plannedVenues = this.plannedVenues.filter(v => v.venueName !== card.venueName);
    this.savePlan();
  }

  isPlanned(card: RecommendationCard): boolean {
    return this.plannedVenues.some(v => v.venueName === card.venueName);
  }

  savePlan() {
    const planKey = `nets_travel_plan_${this.userId}_${this.currentDestination.id}`;
    localStorage.setItem(planKey, JSON.stringify(this.plannedVenues));
  }

  loadPlan() {
    const planKey = `nets_travel_plan_${this.userId}_${this.currentDestination.id}`;
    const saved = localStorage.getItem(planKey);
    if (saved) {
      try {
        this.plannedVenues = JSON.parse(saved);
      } catch {
        this.plannedVenues = [];
      }
    } else {
      this.plannedVenues = [];
    }
  }

  // ========== TRIP MODE ==========

  toggleTripMode() {
    if (this.isTripMode) {
      this.showEndTripConfirmation();
      return;
    }
    this.openBudgetPicker(); // Entering trip mode
  }

  // Budget Picker
  openBudgetPicker() {
    // Pre-fill with DNA recommendation if available
    const dnaRecommended = this.dnaProfile?.travelHints?.typicalTripSpend;
    this.selectedBudgetOption = dnaRecommended || 500;
    this.customBudget = '';
    this.isBudgetPickerOpen = true;
  }

  closeBudgetPicker() {
    this.isBudgetPickerOpen = false;
    this.forceToggleSync();
  }

  selectBudgetOption(amount: number) {
    this.selectedBudgetOption = amount;
    this.customBudget = '';
  }

  onCustomBudgetInput(event: any) {
    const value = event.target.value.replace(/[^0-9]/g, '');
    this.customBudget = value;
    if (value) {
      this.selectedBudgetOption = parseInt(value);
    }
  }

  confirmBudgetAndStartTrip() {
    const budget = this.customBudget ? parseInt(this.customBudget) : this.selectedBudgetOption;
    const duration = this.selectedTripDuration;

    if (!budget || budget < 50) {
      return;
    }

    this.isBudgetPickerOpen = false;
    this.enterTripMode(budget, duration);  // Pass duration
  }

  enterTripMode(budgetAmount: number, durationDays: number = 4) {
    this.tripTotalDays = durationDays;
    this.isTripMode = true;
    this.tripStartDate = new Date().toISOString();
    this.tripDay = 1;

    // 🔒 SET TRIP LOCK
    this.isTripLocked = true;
    this.currentTripCountry = this.currentDestination.id;
    localStorage.setItem(this.TRIP_LOCK_KEY, 'true');
    localStorage.setItem(this.TRIP_COUNTRY_KEY, this.currentDestination.id);

    localStorage.setItem('nets_trip_mode', JSON.stringify({
      active: true,
      startDate: this.tripStartDate,
      day: this.tripDay,
      destination: this.destination,
      budget: budgetAmount,
      duration: durationDays
    }));

    this.budget = {
      spentSoFar: 0,
      typicalTripSpend: budgetAmount,
      remaining: budgetAmount,
      percentage: 0
    };
    this.transactions = [];
    this.saveBudget();
  }

  confirmEndTrip() {
    this.isConfirmingEndTrip = false;
    this.generateTripReport();

    localStorage.removeItem('nets_trip_mode');
    localStorage.removeItem(`nets_travel_budget_${this.userId}`);

    // 🔓 CLEAR TRIP LOCK
    this.isTripLocked = false;
    this.currentTripCountry = null;
    localStorage.removeItem(this.TRIP_LOCK_KEY);
    localStorage.removeItem(this.TRIP_COUNTRY_KEY);

    this.isTripMode = false;
    this.tripDay = 1;
    this.tripStartDate = null;

    this.budget = null;
    this.transactions = [];

    this.tripToEndSummary = null;
    setTimeout(() => this.openReport(), 300);
  }
  showEndTripConfirmation() {
    const totalSpent = this.budget?.spentSoFar || 0;
    const typical = this.budget?.typicalTripSpend || 0;
    const venueCount = new Set(this.transactions.map(t => t.venueName)).size;

    this.tripToEndSummary = {
      totalSpent,
      typical,
      percentageUsed: typical > 0 ? Math.round((totalSpent / typical) * 100) : 0,
      venueCount,
      day: this.tripDay,
      overUnder: totalSpent - typical
    };

    this.isConfirmingEndTrip = true;
  }
  cancelEndTrip() {
    this.isConfirmingEndTrip = false;
    this.tripToEndSummary = null;
    // CRITICAL: Force toggle back to checked since we're staying in trip mode
    this.forceToggleSync();
  }
  forceToggleSync() {
    setTimeout(() => {
      if (this.tripToggle) {
        this.tripToggle.checked = this.isTripMode;
      }
    }, 50);
  }
  // Updated loadTripMode to restore saved budget
  loadTripMode() {
    const saved = localStorage.getItem('nets_trip_mode');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.isTripMode = parsed.active;
        this.tripStartDate = parsed.startDate;
        this.tripDay = parsed.day || 1;
        this.tripTotalDays = parsed.duration || 4;  // ADD THIS
        this.selectedTripDuration = parsed.duration || 4;  // ADD THIS

        if (parsed.budget && !this.budget) {
          this.budget = {
            spentSoFar: 0,
            typicalTripSpend: parsed.budget,
            remaining: parsed.budget,
            percentage: 0
          };
        }
      } catch {
        this.isTripMode = false;
      }
    }
  }

  get dnaBudgetRecommendation(): number {
    return this.dnaProfile?.travelHints?.typicalTripSpend || 0;
  }

  get dnaDailyAverage(): number {
    return this.dnaProfile?.avgDailySpend || 0;
  }

  // ========== SMART ADVISOR ==========

  get homeDailySpend(): number {
    return this.dnaProfile?.avgDailySpend || 45;
  }

  get tripDailySpend(): number {
    if (!this.budget || this.tripDay < 1) return 0;
    return this.budget.spentSoFar / this.tripDay;
  }

  get paceVsHome(): number {
    if (!this.homeDailySpend) return 0;
    return ((this.tripDailySpend - this.homeDailySpend) / this.homeDailySpend) * 100;
  }

  get paceLabel(): string {
    const pace = this.paceVsHome;
    if (pace > 30) return '🔴 Well above pace';
    if (pace > 10) return '🟡 Above pace';
    if (pace > -10) return '🟢 On pace';
    return '🔵 Below pace';
  }

  get paceColor(): string {
    const pace = this.paceVsHome;
    if (pace > 30) return '#d71920';
    if (pace > 10) return '#ff9500';
    if (pace > -10) return '#34c759';
    return '#2f80ed';
  }

  get projectedTotal(): number {
    if (!this.budget || this.tripDay < 1) return 0;
    return this.tripDailySpend * this.tripTotalDays;
  }

  get budgetForecast(): number {
    if (!this.budget) return 0;
    return this.projectedTotal - this.budget.typicalTripSpend;
  }

  get forecastLabel(): string {
    const forecast = this.budgetForecast;
    if (forecast > 50) return `Over by $${forecast.toFixed(0)}`;
    if (forecast < -50) return `Under by $${Math.abs(forecast).toFixed(0)}`;
    return 'On track';
  }

  get forecastColor(): string {
    const forecast = this.budgetForecast;
    if (forecast > 50) return '#d71920';
    if (forecast < -50) return '#34c759';
    return '#888';
  }

  get daysRemaining(): number {
    return Math.max(0, this.tripTotalDays - this.tripDay);
  }

  get dailyAllowanceRemaining(): number {
    if (!this.budget || this.daysRemaining < 1) return 0;
    return this.budget.remaining / this.daysRemaining;
  }

  get foodDrift(): number {
    const foodTxns = this.transactions.filter(t =>
      t.category === 'food' || t.venueName.toLowerCase().includes('cafe') ||
      t.venueName.toLowerCase().includes('restaurant') ||
      t.venueName.toLowerCase().includes('kopitiam')
    );
    const foodSpend = foodTxns.reduce((sum, t) => sum + t.amount, 0);
    if (!this.budget || this.budget.spentSoFar === 0) return 0;
    const tripFoodShare = (foodSpend / this.budget.spentSoFar) * 100;
    const homeFoodShare = (this.dnaProfile?.topCategories?.find((c: any) =>
      c.category === 'Dining' || c.category === 'Coffee'
    )?.share || 0.35) * 100;
    return tripFoodShare - homeFoodShare;
  }

  get advisorTip(): string {
    if (!this.isTripMode || !this.budget) return '';

    const pace = this.paceVsHome;
    const forecast = this.budgetForecast;
    const drift = this.foodDrift;

    if (pace > 40) {
      return `You're spending ${pace.toFixed(0)}% above your Singapore average. Consider cheaper options or you'll exceed budget by $${forecast.toFixed(0)}.`;
    }
    if (drift > 20) {
      return `Food is ${drift.toFixed(0)}% more of your spend than usual. Try a museum or attraction to balance your trip.`;
    }
    if (this.budget.percentage > 75 && this.daysRemaining > 1) {
      return `You've used ${this.budget.percentage.toFixed(0)}% of budget with ${this.daysRemaining} days left. Slow down to $${this.dailyAllowanceRemaining.toFixed(0)}/day.`;
    }
    if (pace < -20) {
      return `You're ${Math.abs(pace).toFixed(0)}% under your usual pace. Great savings — or treat yourself to something special!`;
    }
    return `On track! $${this.dailyAllowanceRemaining.toFixed(0)}/day remaining keeps you within budget.`;
  }

  getPaceBarWidth(): number {
    return Math.min(100, Math.max(0, 50 + this.paceVsHome / 2));
  }

  // ========== CATEGORY SHIFT SIMULATOR ==========

  openSimulator() {
    const cats = [
      { key: 'food', name: 'Food & Dining', color: '#d71920' },
      { key: 'shopping', name: 'Shopping', color: '#ff9500' },
      { key: 'transport', name: 'Transport', color: '#2f80ed' },
      { key: 'activities', name: 'Activities', color: '#34c759' }
    ];

    this.simulatorCategories = cats.map(c => {
      const current = this.getSpentInCategory(c.key);
      const budget = this.categoryBudgets[c.key] || 0;
      return { ...c, current, adjusted: budget > 0 ? budget : Math.round((this.budget?.typicalTripSpend || 500) * 0.25) };
    });

    this.isSimulatorOpen = true;
  }


  closeSimulator() {
    this.isSimulatorOpen = false;
  }

  get simulatorTotal(): number {
    return this.simulatorCategories.reduce((sum, c) => sum + c.adjusted, 0);
  }

  get simulatorRemaining(): number {
    return (this.budget?.typicalTripSpend || 0) - this.simulatorTotal;
  }

  get simulatorForecast(): number {
    return this.simulatorTotal - (this.budget?.typicalTripSpend || 0);
  }

  get simulatorForecastLabel(): string {
    const f = this.simulatorForecast;
    if (f > 0) return `Over by $${f.toFixed(0)}`;
    if (f < 0) return `Under by $${Math.abs(f).toFixed(0)}`;
    return 'On track';
  }

  get simulatorForecastColor(): string {
    const f = this.simulatorForecast;
    if (f > 50) return '#d71920';
    if (f < -50) return '#34c759';
    return '#888';
  }

  get simulatorDaily(): number {
    const days = Math.max(1, this.daysRemaining);
    return this.simulatorRemaining / days;
  }

  get simulatorMaxForCategory(): number {
    const typical = this.budget?.typicalTripSpend || 500;
    return typical * 0.6;
  }

  // ========== POST-TRIP REPORT ==========

  generateTripReport() {
    const totalSpent = this.budget?.spentSoFar || 0;
    const typical = this.budget?.typicalTripSpend || 0;

    const cats = ['food', 'shopping', 'transport', 'activities'];
    const names = ['Food', 'Shopping', 'Transport', 'Activities'];
    const colors = ['#d71920', '#ff9500', '#2f80ed', '#34c759'];

    const categoryBreakdown = cats.map((key, i) => {
      const amount = this.transactions.filter(t => t.category === key).reduce((s, t) => s + t.amount, 0);
      return {
        key,
        name: names[i],
        amount,
        percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        color: colors[i]
      };
    }).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

    const venueNames = [...new Set(this.transactions.map(t => t.venueName))];
    const vsHome = this.paceVsHome;
    const overUnder = totalSpent - typical;

    this.tripReport = {
      totalSpent,
      typical,
      percentageUsed: typical > 0 ? Math.round((totalSpent / typical) * 100) : 0,
      categoryBreakdown,
      venuesVisited: venueNames.length,
      venueNames: venueNames.slice(0, 5),
      vsHome,
      overUnder,
      avgDaily: this.tripDailySpend,
      days: this.tripDay,
      transactions: [...this.transactions]
    };
  }

  openReport() {
    this.isReportOpen = true;
  }

  closeReport() {
    this.isReportOpen = false;
  }

  getReportOverUnderLabel(): string {
    if (!this.tripReport) return '';
    return this.tripReport.overUnder > 0
      ? `Over by $${this.tripReport.overUnder.toFixed(0)}`
      : `Saved $${Math.abs(this.tripReport.overUnder).toFixed(0)}`;
  }

  getReportOverUnderColor(): string {
    if (!this.tripReport) return '#888';
    return this.tripReport.overUnder > 0 ? '#d71920' : '#34c759';
  }

  downloadReport() {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d')!;
    if (!ctx || !this.tripReport) return;

    // Background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, 600, 900);

    // Header
    ctx.fillStyle = '#d71920';
    ctx.fillRect(0, 0, 600, 160);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NETS Beyond', 300, 70);
    ctx.font = '22px sans-serif';
    ctx.fillText('Trip Report — Johor Bahru', 300, 110);

    // Stats
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(`$${this.tripReport.totalSpent.toFixed(0)}`, 50, 260);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('Total Spent', 50, 290);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.tripReport.overUnder > 0 ? '#d71920' : '#34c759';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(this.getReportOverUnderLabel(), 550, 260);
    ctx.fillStyle = '#666';
    ctx.font = '18px sans-serif';
    ctx.fillText(`vs. $${this.tripReport.typical} typical`, 550, 290);

    // Category bars
    let y = 360;
    ctx.textAlign = 'left';
    this.tripReport.categoryBreakdown.forEach((cat: any) => {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(cat.name, 50, y);
      ctx.fillStyle = '#888';
      ctx.font = '16px sans-serif';
      ctx.fillText(`$${cat.amount.toFixed(0)} · ${cat.percentage}%`, 50, y + 24);

      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(50, y + 36, 500, 12);
      ctx.fillStyle = cat.color;
      ctx.fillRect(50, y + 36, 500 * (cat.percentage / 100), 12);

      y += 70;
    });

    // Footer
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.tripReport.venuesVisited} venues visited · ${this.tripReport.days} days`, 300, 860);

    const link = document.createElement('a');
    link.download = `nets-trip-report-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  copyReportText() {
    if (!this.tripReport) return;
    const lines = [
      '🛫 NETS Beyond Trip Report',
      `📍 Johor Bahru, Malaysia`,
      `💰 Total Spent: $${this.tripReport.totalSpent.toFixed(2)}`,
      `📊 vs. Typical: ${this.getReportOverUnderLabel()}`,
      `📍 Venues: ${this.tripReport.venuesVisited}`,
      '',
      'Category Breakdown:',
      ...this.tripReport.categoryBreakdown.map((c: any) => `• ${c.name}: $${c.amount.toFixed(0)} (${c.percentage}%)`)
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      alert('Trip summary copied to clipboard!');
    });
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

  loadSimulatorPlan() {
    const saved = localStorage.getItem(`nets_simulator_plan_${this.userId}`);
    if (saved) {
      try {
        this.simulatorPlan = JSON.parse(saved);
      } catch {
        this.simulatorPlan = {};
      }
    }
  }

  saveSimulatorPlan() {
    localStorage.setItem(`nets_simulator_plan_${this.userId}`, JSON.stringify(this.simulatorPlan));
  }

  applySimulatorPlan() {
    this.simulatorCategories.forEach(cat => {
      this.categoryBudgets[cat.key] = cat.adjusted;
    });
    this.saveCategoryBudgets();
    this.closeSimulator();
  }

  // Get planned amount for a category (for display in advisor)
  getPlannedForCategory(key: string): number {
    return this.simulatorPlan[key] || 0;
  }

  // Check if category is over plan
  getCategoryOverspend(key: string): number {
    const planned = this.simulatorPlan[key] || 0;
    const actual = this.transactions
      .filter(t => t.category === key)
      .reduce((sum, t) => sum + t.amount, 0);
    return actual - planned;
  }

  // Add this method
  abs(value: number): number {
    return Math.abs(value);
  }

  loadCategoryBudgets() {
    const saved = localStorage.getItem(`nets_category_budgets_${this.userId}`);
    if (saved) {
      try {
        this.categoryBudgets = JSON.parse(saved);
      } catch {
        this.categoryBudgets = {};
      }
    }
  } saveCategoryBudgets() {
    localStorage.setItem(`nets_category_budgets_${this.userId}`, JSON.stringify(this.categoryBudgets));
  }

  // Get spent per category
  getSpentInCategory(key: string): number {
    return this.transactions
      .filter(t => t.category === key)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get remaining budget for category
  getCategoryRemaining(key: string): number {
    const budget = this.categoryBudgets[key] || 0;
    return Math.max(0, budget - this.getSpentInCategory(key));
  }

  // Check if category is over budget
  isCategoryOverBudget(key: string): boolean {
    return this.getSpentInCategory(key) > (this.categoryBudgets[key] || 0);
  }

  // Get category overspend amount
  getCategoryOverspendAmount(key: string): number {
    const budget = this.categoryBudgets[key] || 0;
    const spent = this.getSpentInCategory(key);
    return spent > budget ? spent - budget : 0;
  }

  // Infer category from card (reuse your existing logic)
  getCategoryFromCard(card: RecommendationCard): string {
    const n = card.venueName.toLowerCase();
    if (n.includes('cafe') || n.includes('kopitiam') || n.includes('restaurant') || n.includes('food') || n.includes('eats') || n.includes('dining') || n.includes('bakery') || n.includes('hawker') || n.includes('kitchen') || n.includes('noodle')) return 'food';
    if (n.includes('mall') || n.includes('shop') || n.includes('store') || n.includes('market') || n.includes('plaza') || n.includes('boutique') || n.includes('retail')) return 'shopping';
    if (n.includes('museum') || n.includes('park') || n.includes('temple') || n.includes('garden') || n.includes('attraction') || n.includes('zoo') || n.includes('gallery') || n.includes('theme') || n.includes('adventure') || n.includes('beach') || n.includes('landmark')) return 'activities';
    if (n.includes('bus') || n.includes('taxi') || n.includes('train') || n.includes('ferry') || n.includes('transport') || n.includes('mrt') || n.includes('rail') || n.includes('transit') || n.includes('terminal')) return 'transport';
    return 'food';
  }

  getCategoryBudgetPercent(card: RecommendationCard): number {
    const cat = this.getCategoryFromCard(card);
    const budget = this.categoryBudgets[cat] || 1;
    const spent = this.getSpentInCategory(cat);
    return Math.min(100, (spent / budget) * 100);
  }

  getBudgetKeyFromCategoryTitle(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('coffee') || lower.includes('eat') || lower.includes('food') || lower.includes('dining') || lower.includes('hawker') || lower.includes('bakery') || lower.includes('kitchen') || lower.includes('noodle')) return 'food';
    if (lower.includes('shop') || lower.includes('mall') || lower.includes('retail') || lower.includes('boutique') || lower.includes('market') || lower.includes('plaza')) return 'shopping';
    if (lower.includes('transport') || lower.includes('bus') || lower.includes('taxi') || lower.includes('train') || lower.includes('ferry') || lower.includes('mrt') || lower.includes('rail') || lower.includes('transit') || lower.includes('terminal')) return 'transport';
    if (lower.includes('culture') || lower.includes('museum') || lower.includes('park') || lower.includes('temple') || lower.includes('garden') || lower.includes('attraction') || lower.includes('zoo') || lower.includes('gallery') || lower.includes('theme') || lower.includes('adventure') || lower.includes('beach') || lower.includes('landmark') || lower.includes('must-see') || lower.includes('sight')) return 'activities';
    return 'food'; // default
  }

  // Get budget display for category header
  getCategoryBudgetDisplay(title: string): string {
    if (!this.isTripMode) return '';
    const key = this.getBudgetKeyFromCategoryTitle(title);
    const budget = this.categoryBudgets[key] || 0;
    if (budget === 0) return '';

    const spent = this.getSpentInCategory(key);
    const remaining = Math.max(0, budget - spent);
    const isOver = spent > budget;

    if (isOver) {
      return `· $${spent.toFixed(0)} / $${budget.toFixed(0)} · Over by $${(spent - budget).toFixed(0)}`;
    }
    return `· $${spent.toFixed(0)} / $${budget.toFixed(0)} · $${remaining.toFixed(0)} left`;
  }

  // Get budget color for category header
  getCategoryBudgetColor(title: string): string {
    const key = this.getBudgetKeyFromCategoryTitle(title);
    const budget = this.categoryBudgets[key] || 0;
    if (budget === 0) return '#888';

    const spent = this.getSpentInCategory(key);
    if (spent > budget) return '#d71920';
    if (spent / budget > 0.8) return '#ff9500';
    return '#34c759';
  }

  // Call this after places load
  buildWeatherItinerary() {
    this.itinerary = this.weatherService.buildItinerary(this.places, this.forecast);

    // Also create a weather-sorted version of all places for the "Things to Do" tab
    if (this.forecast.length > 0) {
      this.weatherSortedPlaces = this.weatherService.sortPlacesByWeather(
        this.places,
        this.forecast[0] // sort by today's weather
      );
    }
  }

  selectDay(index: number) {
    this.activeDayIndex = index;
  }

  // Helper methods for template
  isIndoorPlace(types: string[]): boolean {
    return this.weatherService.isIndoorPlace(types);
  }

  getDayAdvice(day: DailyForecast): string {
    return this.weatherService.getDayAdvice(day);
  }

  selectDestination(destId: string) {
    // 🔒 TRIP LOCK CHECK
    if (this.isTripLocked && destId !== this.currentTripCountry) {
      // Show alert or silently prevent — using alert for clarity
      alert(`🔒 You're currently on a trip in ${this.currentDestination.name}!\n\nClick "Arrive Home" to end your trip before visiting another country.`);
      this.destinationDropdownOpen = false;
      return;
    }

    if (destId === this.currentDestination.id) {
      this.destinationDropdownOpen = false;
      return;
    }

    this.currentDestination = DESTINATIONS[destId];
    this.loadPlan();
    localStorage.setItem('nets_selected_destination', destId);
    this.destinationDropdownOpen = false;

    // Clear in-memory data for fresh load
    this.recommendations = [];
    this.categories = [];
    this.places = [];
    this.forecast = [];
    this.packingList = [];
    this.itinerary = [];
    this.weatherSortedPlaces = [];
    this.fxInsight = null;

    this.loadAll();
    if (this.isTripMode) {
      this.saveBudget();
    }
  }

  selectAnyCountry(country: CountryInfo) {
    const richConfig = this.countryData.getRichConfig(country.id);

    if (richConfig) {
      // Rich destination — use existing config
      this.selectDestination(richConfig.id);
      return;
    }

    // Exotic country — build dynamic config
    const dynamicDest: any = {
      id: country.id,
      name: country.name,
      country: country.country,
      lat: country.lat,
      lon: country.lon,
      currencyCode: country.currencyCode,
      homeCurrencyCode: 'SGD',
      fxPair: ['SGD', country.currencyCode], // ← MUST be array for FX service
      flag: country.flag,
      region: country.region,
      categories: ['restaurant', 'tourist_attraction', 'shopping_mall', 'cafe', 'park'],
      packingExtras: this.getRegionPacking(country.region),
      newsQuery: `${country.country} tourism`
    };

    this.currentDestination = dynamicDest;
    this.loadPlan();
    localStorage.setItem('nets_selected_destination', JSON.stringify(dynamicDest));

    // Clear and reload
    this.recommendations = [];
    this.categories = [];
    this.places = [];
    this.forecast = [];
    this.packingList = [];
    this.itinerary = [];
    this.weatherSortedPlaces = [];
    this.fxInsight = null;

    this.loadAll();
  }

  private getRegionPacking(region: string): string[] {
    const map: { [key: string]: string[] } = {
      'Asia': ['Light breathable clothing', 'Mosquito repellent', 'Sunscreen', 'Comfortable sandals'],
      'Europe': ['Layered clothing', 'Umbrella', 'Comfortable walking shoes', 'Universal power adapter'],
      'Americas': ['Layered clothing', 'Sunscreen', 'Comfortable shoes', 'Reusable water bottle'],
      'Africa': ['Light cotton clothing', 'Sun hat', 'Insect repellent', 'Sturdy walking shoes'],
      'Oceania': ['Swimwear', 'Sunscreen', 'Light clothing', 'Reusable water bottle'],
    };
    return map[region] || map['Asia'];
  }

  // ========== GLOBE MODAL ==========
  async openGlobeModal() {
    const modal = await this.modalCtrl.create({
      component: CountryGlobeComponent,
      cssClass: 'globe-modal-fullscreen',
      backdropDismiss: true
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data) {
      this.selectAnyCountry(data);
    }
  }

  toggleDestinationDropdown() {
    this.destinationDropdownOpen = !this.destinationDropdownOpen;
  }

  get destinationDisplay(): string {
    return `${this.currentDestination.name}, ${this.currentDestination.country}`;
  }

  private loadForecastAndBuildItinerary() {
    this.weatherService.getForecast(this.currentDestination).subscribe({
      next: (forecast) => {
        this.forecast = forecast;
        this.packingList = this.weatherService.getPackingList(forecast, this.currentDestination);

        // Try to build itinerary — places might already be loaded from cache
        this.tryBuildWeatherItinerary();
      }
    });
  }

  private onPlacesLoaded() {
    // Try to build itinerary — forecast might already be loaded
    this.tryBuildWeatherItinerary();
  }

  /** Safe rebuild — only runs when BOTH places AND forecast are ready */
  private tryBuildWeatherItinerary() {
    if (this.places.length > 0 && this.forecast.length > 0) {
      this.buildWeatherItinerary();
    }
  }

  // ========== MULTI-CURRENCY PAYMENT ==========

  loadMultiCurrencyBalances() {
    if (!this.activeCard?.id) {
      this.multiCurrencyBalances = [];
      return;
    }
    const sgdBalance = getCardFundsAmount(this.activeCard);

    // ← FIX: subscribe to Observable
    this.cardExchange.getAllCurrencies(this.activeCard.id, sgdBalance).subscribe({
      next: (balances: CardCurrencyBalance[]) => {
        this.multiCurrencyBalances = balances;
      },
      error: () => {
        this.multiCurrencyBalances = [];
      }
    });
  }

  getCurrencyBalance(currency: string): number {
    const balance = this.multiCurrencyBalances.find(b => b.currency === currency);
    return balance?.amount || 0;
  }

  hasSufficientBalance(amount: number, currency: string): boolean {
    return this.getCurrencyBalance(currency) >= amount;
  }

  get paymentCurrencySymbol(): string {
    return this.cardExchange.getCurrencySymbol(this.paymentCurrency);
  }

  // Override openPaymentModal to handle foreign currency
  openPaymentModal(venue: RecommendationCard) {
    this.selectedVenue = venue;
    this.paymentCurrency = this.currentDestination.currencyCode || 'SGD';
    this.paymentInForeignCurrency = this.paymentCurrency !== 'SGD';

    // Estimate amount in destination currency
    const estimatedSgd = this.estimateAmount(venue.priceLevel);
    if (this.paymentInForeignCurrency && this.fxInsight?.currentRate) {
      // Convert SGD estimate to foreign currency
      this.paymentAmount = Math.round(estimatedSgd * this.fxInsight.currentRate);
    } else {
      this.paymentAmount = estimatedSgd;
    }

    this.paymentAmountText = this.paymentAmount > 0 ? String(this.paymentAmount) : '';

    // Load latest balances before showing modal
    this.loadMultiCurrencyBalances();

    this.isPaymentModalOpen = true;
  }

  confirmPayment() {
    if (!this.budget || !this.selectedVenue || this.paymentAmount < 0.01) return;

    // Check balance in the correct currency
    if (!this.hasSufficientBalance(this.paymentAmount, this.paymentCurrency)) {
      const bal = this.getCurrencyBalance(this.paymentCurrency);
      const sym = this.paymentCurrencySymbol;
      alert(`Insufficient ${this.paymentCurrency} balance.\n\nAvailable: ${sym}${bal.toFixed(2)}\nNeed: ${sym}${this.paymentAmount.toFixed(2)}\n\nPlease exchange currency in FX Tracker first.`);
      return;
    }

    this.isPaying = true;
    const category = this.inferCategory(this.selectedVenue.venueName);
    const cardId = this.activeCard?.id || 'default';
    const userId = this.auth.userId ?? 'user_1';

    // ─── CALL BACKEND TO DEDUCT ───
    this.cardsService.deductCurrency(userId, cardId, {
      currency: this.paymentCurrency,
      amount: this.paymentAmount
    }).subscribe({
      next: (result) => {
        this.isPaying = false;

        if (!result.success) {
          alert(result.message);
          return;
        }

        // Calculate SGD equivalent for budget tracking
        let sgdEquivalent: number;
        if (this.paymentInForeignCurrency && this.fxInsight?.currentRate) {
          sgdEquivalent = this.paymentAmount / this.fxInsight.currentRate;
        } else {
          sgdEquivalent = this.paymentAmount;
        }

        // Update travel budget
        this.budget!.spentSoFar += sgdEquivalent;
        this.budget!.remaining = Math.max(0, this.budget!.typicalTripSpend - this.budget!.spentSoFar);
        this.budget!.percentage = Math.min(
          100,
          (this.budget!.spentSoFar / this.budget!.typicalTripSpend) * 100
        );

        // Record transaction
        this.transactions.unshift({
          id: Date.now().toString(),
          venueName: this.selectedVenue!.venueName,
          amount: sgdEquivalent,
          timestamp: new Date().toISOString(),
          cardLabel: this.activeCard ? formatCardPaymentLabel(this.activeCard) : 'NETS Card',
          category,
        });

        if (this.transactions.length > 5) {
          this.transactions = this.transactions.slice(0, 5);
        }

        this.saveBudget();
        this.plannedVenues = this.plannedVenues.filter(v => v.venueName !== this.selectedVenue?.venueName);
        this.savePlan();

        // Update home page via event
        window.dispatchEvent(new CustomEvent('nets:travelPaymentCompleted', {
          detail: {
            cardId: cardId,
            currency: this.paymentCurrency,
            amount: this.paymentAmount,
            sgdEquivalent: sgdEquivalent,
            venue: this.selectedVenue?.venueName,
            newBalances: result.newBalances
          }
        }));

        // Reload balances to reflect deduction
        this.loadMultiCurrencyBalances();
        this.closePaymentModal();
      },
      error: () => {
        this.isPaying = false;
        alert('Payment failed. Please try again.');
      }
    });
  }

  getCurrencySymbol(currency: string): string {
    return this.cardExchange.getCurrencySymbol(currency);
  }

  // Update payment modal HTML to show currency
  get paymentCurrencyLabel(): string {
    return this.getCurrencySymbol(this.paymentCurrency);
  }
  selectTripDuration(days: number) {
    this.selectedTripDuration = days;
  }

  private loadTripLockState(): void {
    const locked = localStorage.getItem(this.TRIP_LOCK_KEY);
    const country = localStorage.getItem(this.TRIP_COUNTRY_KEY);
    this.isTripLocked = locked === 'true';
    this.currentTripCountry = country;

    if (this.isTripLocked && this.currentTripCountry) {
      // If locked but not in trip mode, restore trip mode (app restart case)
      if (!this.isTripMode) {
        const saved = localStorage.getItem('nets_trip_mode');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            this.isTripMode = true;
            this.tripStartDate = parsed.startDate;
            this.tripDay = parsed.day || 1;
            this.tripTotalDays = parsed.duration || 4;
            this.selectedTripDuration = parsed.duration || 4;
          } catch { /* ignore */ }
        }
      }

      // Force destination to locked country
      if (this.currentDestination.id !== this.currentTripCountry) {
        const lockedDest = DESTINATIONS[this.currentTripCountry];
        if (lockedDest) {
          this.currentDestination = lockedDest;
          localStorage.setItem('nets_selected_destination', this.currentTripCountry);
        }
      }
    }
  }
  private migrateOldPlans(): void {
    const oldKey = `nets_travel_plan_${this.userId}`;
    const oldPlan = localStorage.getItem(oldKey);
    if (oldPlan) {
      try {
        const venues: RecommendationCard[] = JSON.parse(oldPlan);
        if (venues.length > 0) {
          // Save to country-scoped key
          const newKey = `nets_travel_plan_${this.userId}_${this.currentDestination.id}`;
          localStorage.setItem(newKey, oldPlan);
        }
        localStorage.removeItem(oldKey); // Remove old key
      } catch { /* ignore */ }
    }
  }
}