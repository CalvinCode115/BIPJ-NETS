import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TravelService } from './travel.service';
import { FxTrackerService } from './fx-tracker/fx-tracker.service';
import { AuthService } from '../../services/auth.service';
import { CardContextService } from '../../services/card-context.service';
import { GooglePlace } from './travel.model';
import {
  CountryDataService,
  CountryInfo,
} from '../../services/country-data.service';
import { CountryGlobeComponent } from '../../components/country-globe/country-globe.component';
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
} from '../../services/cards.service';
import {
  DestinationConfig,
  DESTINATIONS,
  DEFAULT_DESTINATION,
} from '../../services/destination.config';
import { CacheService } from '../../services/cache.service';
import {
  displayedCardBalance as formatDisplayedCardBalance,
  displayedCardNumber as formatDisplayedCardNumber,
} from '../../utils/card-display';
import { sanitizeDecimalAmountInput } from '../../utils/amount-input';
import {
  RecommendationCard,
  CategorySection,
  BudgetTracker,
  FxInsight,
  TravelTransaction,
} from './travel.model';

import { PackingItem, WeatherService, DailyForecast } from './weather.service';
import {
  CardCurrencyBalance,
  CardLinkedExchangeService,
} from '../../services/card-linked-exchange.service';
import {
  SmartPlannerService,
  PlannedVenue,
  DayPlan,
} from '../../services/smart-planner.service';
import { RouteService, DirectionsResponse } from '../../services/route.service';
import { PetBridgeService } from 'src/app/services/pet-bridge.service';
import { TransactionsService } from 'src/app/services/transactions.service';
@Component({
  selector: 'app-travel',
  templateUrl: './travel.page.html',
  styleUrls: ['./travel.page.scss'],
  standalone: false,
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
  get userId(): string {
    return this.auth.userId ?? 'user_1';
  }
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
  get TRIP_LOCK_KEY(): string {
    return `nets_trip_locked_${this.userId}`;
  }
  get TRIP_COUNTRY_KEY(): string {
    return `nets_trip_country_${this.userId}`;
  }

  // DNA Profile
  dnaProfile: any = null;
  plannedVenues: RecommendationCard[] = [];

  // Simulator
  isSimulatorOpen = false;
  simulatorCategories: {
    name: string;
    key: string;
    current: number;
    adjusted: number;
    color: string;
  }[] = [];

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

  dayPlans: DayPlan[] = [];
  numTripDays: number = 3;
  autoOptimizeDays = true;
  isGeneratingPlans = false;

  isTimePickerOpen = false;
  selectedVenueForTime: PlannedVenue | null = null;
  selectedTime: string = '08:00';

  isAlternativesModalOpen = false;
  alternativesForVenue: PlannedVenue | null = null;
  alternativeOptions: PlannedVenue[] = [];
  isLoadingAlternatives = false;
  private generationCount = 0;

  nearbyCache = new Map<
    string,
    Array<{ name: string; distance: number; type: string; isDna: boolean }>
  >();

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
    private smartPlanner: SmartPlannerService,
    private routeService: RouteService,
    private cdr: ChangeDetectorRef,
    private petBridge: PetBridgeService,
    private transactionsService: TransactionsService,
  ) {}

ngOnInit() {
    const userId = this.auth.userId;

    if (!userId) {
      this.error = 'Please log in to use currency exchange.';
      return;
    }

    // Now use userId here (no redeclaration)
    const savedDest = localStorage.getItem(
      `nets_selected_destination_${userId}`,
    );
    if (savedDest) {
      if (DESTINATIONS[savedDest]) {
        this.currentDestination = DESTINATIONS[savedDest];
      } else {
        try {
          const parsed = JSON.parse(savedDest);
          if (parsed && parsed.id) {
            this.currentDestination = {
              ...parsed,
              homeCurrencyCode: parsed.homeCurrencyCode || 'SGD',
              currencyCode: parsed.currencyCode || parsed.fxPair?.[1] || 'USD',
              fxPair: Array.isArray(parsed.fxPair)
                ? parsed.fxPair
                : ['SGD', parsed.currencyCode || 'USD'],
            };
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
    this.loadTravelData(); // ← this now fetches places too
    this.loadWeather();
    this.loadFxCircle();
    this.loadForecastAndBuildItinerary();

    this.weatherService.getForecast(this.currentDestination).subscribe({
      next: (forecast) => {
        this.forecast = forecast;
        this.packingList = this.weatherService.getPackingList(
          forecast,
          this.currentDestination,
        );
        // buildWeatherItinerary() is now called inside loadTravelData() when places arrive
      },
    });
  }

  // ========== TRAVEL DATA ==========
  // Update loadTravelData to call onPlacesLoaded
  loadTravelData() {
    this.isLoading = true;
    this.error = null;
    const now = new Date();

    this.travelService
      .getTravelRecommendations(
        this.userId,
        this.currentDestination,
        now.getMonth() + 1,
        now.getFullYear(),
      )
      .subscribe({
        next: (result) => {
          this.recommendations = result.dnaPicks || [];
          this.categories = (result.categories || []).map(
            (cat: CategorySection) => ({
              ...cat,
              visibleCount: 3,
            }),
          );
          this.places = result.places || [];

          // ═══ FIX: Attach coordinates from places to recommendations ═══
          this.attachCoordinates();

          if (result.budget && !this.budget) {
            this.budget = result.budget;
            this.saveBudget();
          }

          this.onPlacesLoaded();
          this.isLoading = false;
        },
        error: (err: any) => {
          this.error = err.message || 'Something went wrong';
          this.isLoading = false;
        },
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
      },
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
    const supportedFxCurrencies = [
      'MYR',
      'THB',
      'JPY',
      'KRW',
      'AUD',
      'USD',
      'EUR',
      'GBP',
      'SGD',
      'CNY',
      'IDR',
      'PHP',
      'VND',
      'INR',
    ];
    const currency = this.currentDestination?.currencyCode;

    if (currency && !supportedFxCurrencies.includes(currency)) {
      this.fxInsight = null;
      return;
    }

    this.fxService
      .getFxInsightWithPrediction(this.currentDestination, 7)
      .subscribe({
        next: (insight) => (this.fxInsight = insight),
        error: (err) => {
          console.error('FX load failed:', err);
          this.fxInsight = null;
        },
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
      }),
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
    if (
      n.includes('cafe') ||
      n.includes('kopitiam') ||
      n.includes('restaurant') ||
      n.includes('food') ||
      n.includes('eats') ||
      n.includes('dining') ||
      n.includes('bakery') ||
      n.includes('hawker') ||
      n.includes('kitchen') ||
      n.includes('noodle')
    )
      return 'food';
    if (
      n.includes('mall') ||
      n.includes('shop') ||
      n.includes('store') ||
      n.includes('market') ||
      n.includes('plaza') ||
      n.includes('boutique') ||
      n.includes('retail')
    )
      return 'shopping';
    if (
      n.includes('museum') ||
      n.includes('park') ||
      n.includes('temple') ||
      n.includes('garden') ||
      n.includes('attraction') ||
      n.includes('zoo') ||
      n.includes('gallery') ||
      n.includes('theme') ||
      n.includes('adventure') ||
      n.includes('beach') ||
      n.includes('landmark')
    )
      return 'activities';
    if (
      n.includes('bus') ||
      n.includes('taxi') ||
      n.includes('train') ||
      n.includes('ferry') ||
      n.includes('transport') ||
      n.includes('mrt') ||
      n.includes('rail') ||
      n.includes('transit') ||
      n.includes('terminal')
    )
      return 'transport';
    return 'food';
  }

  // ========== PAYMENT MODAL ==========

  loadActiveCard() {
    const userId = this.auth.userId || this.userId;
    const selected = this.cardContext.getSelectedCard();

    this.cardsService.getWallet(userId).subscribe({
      next: (wallet: any) => {
        const fallback =
          wallet.prepaid[0] ?? wallet.cashcard[0] ?? wallet.others[0] ?? null;
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
    const { text, amount } = sanitizeDecimalAmountInput(
      String(event.detail.value ?? ''),
    );
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
    if (!this.plannedVenues.find((v) => v.venueName === card.venueName)) {
      let lat = card.lat;
      let lng = card.lng;

      // Active lookup from places
      if (!lat || !lng) {
        const match = this.places.find((p) => {
          const pName = p.name?.toLowerCase() || '';
          const cName = card.venueName?.toLowerCase() || '';
          return (
            pName === cName ||
            pName.includes(cName) ||
            cName.includes(pName) ||
            p.vicinity?.toLowerCase().includes(cName)
          );
        });

        if (match?.geometry?.location) {
          lat = match.geometry.location.lat;
          lng = match.geometry.location.lng;
          console.log('Found place match for', card.venueName, ':', lat, lng);
        }
      }

      if ((!lat || !lng) && card.location) {
        lat = card.location.latitude;
        lng = card.location.longitude;
      }

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        const center = this.getDestinationCenter();
        lat = center.lat + (Math.random() - 0.5) * 0.08;
        lng = center.lng + (Math.random() - 0.5) * 0.08;
        console.warn(
          'Fallback for',
          card.venueName,
          ':',
          lat.toFixed(5),
          lng.toFixed(5),
        );
      }

      const venueWithCoords = { ...card, lat, lng };
      this.plannedVenues.push(venueWithCoords);
      this.savePlan();

      console.log(
        'Added:',
        card.venueName,
        'at',
        lat.toFixed(5),
        lng.toFixed(5),
      );
    }
  }
  removeFromPlan(card: RecommendationCard) {
    this.plannedVenues = this.plannedVenues.filter(
      (v) => v.venueName !== card.venueName,
    );
    this.savePlan();
  }

  isPlanned(card: RecommendationCard): boolean {
    return this.plannedVenues.some((v) => v.venueName === card.venueName);
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
    const budget = this.customBudget
      ? parseInt(this.customBudget)
      : this.selectedBudgetOption;
    const duration = this.selectedTripDuration;

    if (!budget || budget < 50) {
      return;
    }

    this.isBudgetPickerOpen = false;
    this.enterTripMode(budget, duration); // Pass duration
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

    localStorage.setItem(
      `nets_trip_mode_${this.userId}`,
      JSON.stringify({
        active: true,
        startDate: this.tripStartDate,
        day: this.tripDay,
        destination: this.destination,
        budget: budgetAmount,
        duration: durationDays,
      }),
    );

    this.budget = {
      spentSoFar: 0,
      typicalTripSpend: budgetAmount,
      remaining: budgetAmount,
      percentage: 0,
    };
    this.transactions = [];
    this.saveBudget();
  }

  confirmEndTrip() {
    this.isConfirmingEndTrip = false;
    this.generateTripReport();

    localStorage.removeItem(`nets_trip_mode_${this.userId}`);
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
    const venueCount = new Set(this.transactions.map((t) => t.venueName)).size;

    this.tripToEndSummary = {
      totalSpent,
      typical,
      percentageUsed:
        typical > 0 ? Math.round((totalSpent / typical) * 100) : 0,
      venueCount,
      day: this.tripDay,
      overUnder: totalSpent - typical,
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
    const saved = localStorage.getItem(`nets_trip_mode_${this.userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.isTripMode = parsed.active;
        this.tripStartDate = parsed.startDate;
        this.tripDay = parsed.day || 1;
        this.tripTotalDays = parsed.duration || 4; // ADD THIS
        this.selectedTripDuration = parsed.duration || 4; // ADD THIS

        if (parsed.budget && !this.budget) {
          this.budget = {
            spentSoFar: 0,
            typicalTripSpend: parsed.budget,
            remaining: parsed.budget,
            percentage: 0,
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
    return (
      ((this.tripDailySpend - this.homeDailySpend) / this.homeDailySpend) * 100
    );
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
    const foodTxns = this.transactions.filter(
      (t) =>
        t.category === 'food' ||
        t.venueName.toLowerCase().includes('cafe') ||
        t.venueName.toLowerCase().includes('restaurant') ||
        t.venueName.toLowerCase().includes('kopitiam'),
    );
    const foodSpend = foodTxns.reduce((sum, t) => sum + t.amount, 0);
    if (!this.budget || this.budget.spentSoFar === 0) return 0;
    const tripFoodShare = (foodSpend / this.budget.spentSoFar) * 100;
    const homeFoodShare =
      (this.dnaProfile?.topCategories?.find(
        (c: any) => c.category === 'Dining' || c.category === 'Coffee',
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
      { key: 'activities', name: 'Activities', color: '#34c759' },
    ];

    this.simulatorCategories = cats.map((c) => {
      const current = this.getSpentInCategory(c.key);
      const budget = this.categoryBudgets[c.key] || 0;
      return {
        ...c,
        current,
        adjusted:
          budget > 0
            ? budget
            : Math.round((this.budget?.typicalTripSpend || 500) * 0.25),
      };
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

    const categoryBreakdown = cats
      .map((key, i) => {
        const amount = this.transactions
          .filter((t) => t.category === key)
          .reduce((s, t) => s + t.amount, 0);
        return {
          key,
          name: names[i],
          amount,
          percentage:
            totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
          color: colors[i],
        };
      })
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const venueNames = [...new Set(this.transactions.map((t) => t.venueName))];
    const vsHome = this.paceVsHome;
    const overUnder = totalSpent - typical;

    this.tripReport = {
      totalSpent,
      typical,
      percentageUsed:
        typical > 0 ? Math.round((totalSpent / typical) * 100) : 0,
      categoryBreakdown,
      venuesVisited: venueNames.length,
      venueNames: venueNames.slice(0, 5),
      vsHome,
      overUnder,
      avgDaily: this.tripDailySpend,
      days: this.tripDay,
      transactions: [...this.transactions],
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
      ctx.fillText(
        `$${cat.amount.toFixed(0)} · ${cat.percentage}%`,
        50,
        y + 24,
      );

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
    ctx.fillText(
      `${this.tripReport.venuesVisited} venues visited · ${this.tripReport.days} days`,
      300,
      860,
    );

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
      ...this.tripReport.categoryBreakdown.map(
        (c: any) => `• ${c.name}: $${c.amount.toFixed(0)} (${c.percentage}%)`,
      ),
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

  getPriceLevel(level: number | undefined): string {
    const l = level || 1;
    return '$'.repeat(l);
  }

  getStars(rating: number | undefined): string {
    const r = rating || 0;
    return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  }

  openInMaps(card: RecommendationCard) {
    const query = encodeURIComponent(`${card.venueName}, ${card.address}`);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      '_blank',
    );
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
    localStorage.setItem(
      `nets_simulator_plan_${this.userId}`,
      JSON.stringify(this.simulatorPlan),
    );
  }

  applySimulatorPlan() {
    this.simulatorCategories.forEach((cat) => {
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
      .filter((t) => t.category === key)
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
  }
  saveCategoryBudgets() {
    localStorage.setItem(
      `nets_category_budgets_${this.userId}`,
      JSON.stringify(this.categoryBudgets),
    );
  }

  // Get spent per category
  getSpentInCategory(key: string): number {
    return this.transactions
      .filter((t) => t.category === key)
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
    if (
      n.includes('cafe') ||
      n.includes('kopitiam') ||
      n.includes('restaurant') ||
      n.includes('food') ||
      n.includes('eats') ||
      n.includes('dining') ||
      n.includes('bakery') ||
      n.includes('hawker') ||
      n.includes('kitchen') ||
      n.includes('noodle')
    )
      return 'food';
    if (
      n.includes('mall') ||
      n.includes('shop') ||
      n.includes('store') ||
      n.includes('market') ||
      n.includes('plaza') ||
      n.includes('boutique') ||
      n.includes('retail')
    )
      return 'shopping';
    if (
      n.includes('museum') ||
      n.includes('park') ||
      n.includes('temple') ||
      n.includes('garden') ||
      n.includes('attraction') ||
      n.includes('zoo') ||
      n.includes('gallery') ||
      n.includes('theme') ||
      n.includes('adventure') ||
      n.includes('beach') ||
      n.includes('landmark')
    )
      return 'activities';
    if (
      n.includes('bus') ||
      n.includes('taxi') ||
      n.includes('train') ||
      n.includes('ferry') ||
      n.includes('transport') ||
      n.includes('mrt') ||
      n.includes('rail') ||
      n.includes('transit') ||
      n.includes('terminal')
    )
      return 'transport';
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
    if (
      lower.includes('coffee') ||
      lower.includes('eat') ||
      lower.includes('food') ||
      lower.includes('dining') ||
      lower.includes('hawker') ||
      lower.includes('bakery') ||
      lower.includes('kitchen') ||
      lower.includes('noodle')
    )
      return 'food';
    if (
      lower.includes('shop') ||
      lower.includes('mall') ||
      lower.includes('retail') ||
      lower.includes('boutique') ||
      lower.includes('market') ||
      lower.includes('plaza')
    )
      return 'shopping';
    if (
      lower.includes('transport') ||
      lower.includes('bus') ||
      lower.includes('taxi') ||
      lower.includes('train') ||
      lower.includes('ferry') ||
      lower.includes('mrt') ||
      lower.includes('rail') ||
      lower.includes('transit') ||
      lower.includes('terminal')
    )
      return 'transport';
    if (
      lower.includes('culture') ||
      lower.includes('museum') ||
      lower.includes('park') ||
      lower.includes('temple') ||
      lower.includes('garden') ||
      lower.includes('attraction') ||
      lower.includes('zoo') ||
      lower.includes('gallery') ||
      lower.includes('theme') ||
      lower.includes('adventure') ||
      lower.includes('beach') ||
      lower.includes('landmark') ||
      lower.includes('must-see') ||
      lower.includes('sight')
    )
      return 'activities';
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
    this.itinerary = this.weatherService.buildItinerary(
      this.places,
      this.forecast,
    );

    // Also create a weather-sorted version of all places for the "Things to Do" tab
    if (this.forecast.length > 0) {
      this.weatherSortedPlaces = this.weatherService.sortPlacesByWeather(
        this.places,
        this.forecast[0], // sort by today's weather
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

  getPhotoUrl(place: GooglePlace): string | undefined {
    return this.travelService.getPhotoUrl(place);
  }

  getDayAdvice(day: DailyForecast): string {
    return this.weatherService.getDayAdvice(day);
  }

  selectDestination(destId: string) {
    // 🔒 TRIP LOCK CHECK
    if (this.isTripLocked && destId !== this.currentTripCountry) {
      // Show alert or silently prevent — using alert for clarity
      alert(
        `🔒 You're currently on a trip in ${this.currentDestination.name}!\n\nClick "Arrive Home" to end your trip before visiting another country.`,
      );
      this.destinationDropdownOpen = false;
      return;
    }

    if (destId === this.currentDestination.id) {
      this.destinationDropdownOpen = false;
      return;
    }

    this.currentDestination = DESTINATIONS[destId];
    this.loadPlan();
    localStorage.setItem(`nets_selected_destination_${this.userId}`, destId);
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
    // Map ISO code back to destination config key
    const isoToDestKey: Record<string, string> = {
      my: 'malaysia',
      th: 'thailand',
      jp: 'japan',
      kr: 'korea',
      au: 'australia',
    };

    const destKey = isoToDestKey[country.id];

    if (destKey && DESTINATIONS[destKey]) {
      // Rich destination — use existing config with proper key
      this.selectDestination(destKey);
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
      categories: [
        'restaurant',
        'tourist_attraction',
        'shopping_mall',
        'cafe',
        'park',
      ],
      packingExtras: this.getRegionPacking(country.region),
      newsQuery: `${country.country} tourism`,
    };

    this.currentDestination = dynamicDest;
    this.loadPlan();
    localStorage.setItem(
      `nets_selected_destination_${this.userId}`,
      JSON.stringify(dynamicDest),
    );

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
      Asia: [
        'Light breathable clothing',
        'Mosquito repellent',
        'Sunscreen',
        'Comfortable sandals',
      ],
      Europe: [
        'Layered clothing',
        'Umbrella',
        'Comfortable walking shoes',
        'Universal power adapter',
      ],
      Americas: [
        'Layered clothing',
        'Sunscreen',
        'Comfortable shoes',
        'Reusable water bottle',
      ],
      Africa: [
        'Light cotton clothing',
        'Sun hat',
        'Insect repellent',
        'Sturdy walking shoes',
      ],
      Oceania: [
        'Swimwear',
        'Sunscreen',
        'Light clothing',
        'Reusable water bottle',
      ],
    };
    return map[region] || map['Asia'];
  }

  // ========== GLOBE MODAL ==========
  async openGlobeModal() {
    const modal = await this.modalCtrl.create({
      component: CountryGlobeComponent,
      cssClass: 'globe-modal-fullscreen',
      backdropDismiss: true,
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
        this.packingList = this.weatherService.getPackingList(
          forecast,
          this.currentDestination,
        );

        // Try to build itinerary — places might already be loaded from cache
        this.tryBuildWeatherItinerary();
      },
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

    const userId = this.auth.userId ?? this.userId;

    // FIX: Read from the same Firestore endpoint that fx-tracker writes to
    this.cardsService.getCardWallet(userId, this.activeCard.id).subscribe({
      next: (multiWallet: MultiCurrencyWallet) => {
        this.multiCurrencyBalances = multiWallet.currencies.map((currency) => ({
          currency,
          amount: multiWallet.balances[currency] || 0,
          flag: this.getCurrencyFlag(currency), // ← ADD THIS
        }));
      },
      error: () => {
        // Fallback: just SGD from the card itself
        const sgdBalance = getCardFundsAmount(this.activeCard);
        this.multiCurrencyBalances = [
          {
            currency: 'SGD',
            amount: sgdBalance,
            flag: this.getCurrencyFlag('SGD'), // ← ADD THIS
          },
        ];
      },
    });
  }
  private getCurrencyFlag(currency: string): string {
    const flags: Record<string, string> = {
      SGD: '🇸🇬',
      MYR: '🇲🇾',
      THB: '🇹🇭',
      JPY: '🇯🇵',
      KRW: '🇰🇷',
      AUD: '🇦🇺',
      USD: '🇺🇸',
      EUR: '🇪🇺',
      GBP: '🇬🇧',
      CNY: '🇨🇳',
      HKD: '🇭🇰',
      CAD: '🇨🇦',
      CHF: '🇨🇭',
      INR: '🇮🇳',
      IDR: '🇮🇩',
      PHP: '🇵🇭',
      VND: '🇻🇳',
      NZD: '🇳🇿',
    };
    return flags[currency] || '💱';
  }

  getCurrencyBalance(currency: string): number {
    const balance = this.multiCurrencyBalances.find(
      (b) => b.currency === currency,
    );
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
      this.paymentAmount = Math.round(
        estimatedSgd * this.fxInsight.currentRate,
      );
    } else {
      this.paymentAmount = estimatedSgd;
    }

    this.paymentAmountText =
      this.paymentAmount > 0 ? String(this.paymentAmount) : '';

    // Load latest balances before showing modal
    this.loadMultiCurrencyBalances();

    this.isPaymentModalOpen = true;
  }

  confirmPayment() {
    if (!this.budget || !this.selectedVenue || this.paymentAmount < 0.01)
      return;

    // Check balance in the correct currency
    if (!this.hasSufficientBalance(this.paymentAmount, this.paymentCurrency)) {
      const bal = this.getCurrencyBalance(this.paymentCurrency);
      const sym = this.paymentCurrencySymbol;
      alert(
        `Insufficient ${this.paymentCurrency} balance.\n\nAvailable: ${sym}${bal.toFixed(2)}\nNeed: ${sym}${this.paymentAmount.toFixed(2)}\n\nPlease exchange currency in FX Tracker first.`,
      );
      return;
    }

    this.isPaying = true;
    const category = this.inferCategory(this.selectedVenue.venueName);
    const cardId = this.activeCard?.id || 'default';
    const userId = this.auth.userId ?? 'user_1';

    // Calculate SGD equivalent ONCE before the API call
    let sgdEquivalent: number;
    if (this.paymentInForeignCurrency && this.fxInsight?.currentRate) {
      sgdEquivalent = this.paymentAmount / this.fxInsight.currentRate;
    } else {
      sgdEquivalent = this.paymentAmount;
    }

    // ─── CALL BACKEND TO DEDUCT ───
    this.cardsService
      .deductCurrency(userId, cardId, {
        currency: this.paymentCurrency,
        amount: this.paymentAmount,
        sgdEquivalent: sgdEquivalent,
        venue: this.selectedVenue?.venueName,
        category: category,
      })
      .subscribe({
        next: (result) => {
          this.isPaying = false;
          if (!result.success) {
            alert(result.message);
            return;
          }

          // Budget tracking (your existing code)
          this.budget!.spentSoFar += sgdEquivalent;
          this.budget!.remaining = Math.max(
            0,
            this.budget!.typicalTripSpend - this.budget!.spentSoFar,
          );
          this.budget!.percentage = Math.min(
            100,
            (this.budget!.spentSoFar / this.budget!.typicalTripSpend) * 100,
          );

          // Record transaction
          this.transactions.unshift({
            id: Date.now().toString(),
            venueName: this.selectedVenue!.venueName,
            amount: sgdEquivalent,
            timestamp: new Date().toISOString(),
            cardLabel: this.activeCard
              ? formatCardPaymentLabel(this.activeCard)
              : 'NETS Card',
            category,
          });

          if (this.transactions.length > 5) {
            this.transactions = this.transactions.slice(0, 5);
          }

          this.saveBudget();
          this.plannedVenues = this.plannedVenues.filter(
            (v) => v.venueName !== this.selectedVenue?.venueName,
          );
          this.savePlan();

          // ═══ NEW: Feed pet & persist XP (same as QrPaymentsService) ═══
          const pet = this.petBridge.record(
            sgdEquivalent,
            category,
            this.selectedVenue?.venueName || 'Travel Payment',
          );

          // Persist XP to backend using the transaction ID from backend
          if (result.transaction?.id && pet) {
            this.transactionsService
              .recordTxnRewards(userId, result.transaction.id, {
                xpGained: pet.xpGained,
                xpCapped: pet.xpCapped,
              })
              .subscribe();
          }

          // Dispatch event with pet data so home page can display points/XP
          window.dispatchEvent(
            new CustomEvent('nets:travelPaymentCompleted', {
              detail: {
                cardId: cardId,
                currency: this.paymentCurrency,
                amount: this.paymentAmount,
                sgdEquivalent: sgdEquivalent,
                venue: this.selectedVenue?.venueName,
                category: category,
                timestamp: new Date().toISOString(),
                newBalances: result.newBalances,
                pointsAwarded: result.pointsAwarded ?? 0,
                transactionId: result.transaction?.id,
                pet: pet
                  ? {
                      // ← ADD: pet data for home page display
                      xpGained: pet.xpGained,
                      pointsEarned: pet.pointsEarned,
                      xpCapped: pet.xpCapped,
                    }
                  : null,
              },
            }),
          );
          this.loadMultiCurrencyBalances();
          this.closePaymentModal();
        },
        error: () => {
          this.isPaying = false;
          alert('Payment failed. Please try again.');
        },
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
    const locked = localStorage.getItem(`nets_trip_locked_${this.userId}`);
    const country = localStorage.getItem(`nets_trip_country_${this.userId}`);
    this.isTripLocked = locked === 'true';
    this.currentTripCountry = country;

    if (this.isTripLocked && this.currentTripCountry) {
      // If locked but not in trip mode, restore trip mode (app restart case)
      if (!this.isTripMode) {
        const saved = localStorage.getItem(`nets_trip_mode_${this.userId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            this.isTripMode = true;
            this.tripStartDate = parsed.startDate;
            this.tripDay = parsed.day || 1;
            this.tripTotalDays = parsed.duration || 4;
            this.selectedTripDuration = parsed.duration || 4;
          } catch {
            /* ignore */
          }
        }
      }

      // Force destination to locked country
      if (this.currentDestination.id !== this.currentTripCountry) {
        const lockedDest = DESTINATIONS[this.currentTripCountry];
        if (lockedDest) {
          this.currentDestination = lockedDest;
          localStorage.setItem(
            'nets_selected_destination',
            this.currentTripCountry,
          );
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
      } catch {
        /* ignore */
      }
    }
  }

  async generateDayPlans() {
    if (!this.plannedVenues.length) {
      alert('Add some venues to your plan first!');
      return;
    }

    // LOCK: Prevent double-clicks
    if (this.isGeneratingPlans) return;

    this.isGeneratingPlans = true;
    this.generationCount++; // Bump for variation

    try {
      const center = this.getDestinationCenter();
      const venues = this.smartPlanner.convertPlannedVenues(
        this.plannedVenues,
        center,
      );

      this.dayPlans = await this.smartPlanner.buildItinerary(
        venues,
        this.searchNearbyPoint.bind(this),
        this.numTripDays,
        this.recommendations,
        this.generationCount, // ← PASS variation seed
      );

      for (let i = 0; i < this.dayPlans.length; i++) {
        await this.loadDayRoute(this.dayPlans[i], i);
      }
      this.precomputeNearbySuggestions();
    } finally {
      this.isGeneratingPlans = false;
    }
  }

  getDestinationCenter(): { lat: number; lng: number } {
    const centers: Record<string, { lat: number; lng: number }> = {
      'johor-bahru': { lat: 1.4927, lng: 103.7414 },
      tokyo: { lat: 35.6762, lng: 139.6503 },
      bangkok: { lat: 13.7563, lng: 100.5018 },
      seoul: { lat: 37.5665, lng: 126.978 },
      'kuala-lumpur': { lat: 3.139, lng: 101.6869 },
      sydney: { lat: -33.8688, lng: 151.2093 },
    };

    const result = centers[this.currentDestination.id] || {
      lat: 1.35,
      lng: 103.8,
    };
    console.log(
      'Destination center for',
      this.currentDestination.id,
      ':',
      result,
    );
    return result;
  }

  logCardFields(card: any) {
    console.log('=== CARD FIELDS ===');
    console.log('venueName:', card.venueName);
    console.log('Has location?:', !!card.location);
    console.log('location:', card.location);
    console.log('Has lat?:', !!card.lat, card.lat);
    console.log('Has lng?:', !!card.lng, card.lng);
    console.log('Has geometry?:', !!card.geometry);
    console.log('Has coordinates?:', !!card.coordinates);
    console.log('All keys:', Object.keys(card));
    console.log('===================');
  }
  onDaysChange(event: any) {
    this.numTripDays = parseInt(event.detail.value, 10);
  }

  private attachCoordinates() {
    // Create a lookup map from place_id or name to coordinates
    const placeCoords = new Map<string, { lat: number; lng: number }>();

    for (const place of this.places) {
      const key = place.place_id || place.name;
      if (place.geometry?.location) {
        placeCoords.set(key, {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        });
      }
    }

    // Attach to recommendations
    for (const rec of this.recommendations) {
      // Try to find matching place by name
      const match = this.places.find(
        (p) =>
          p.name === rec.venueName ||
          p.vicinity?.includes(rec.venueName) ||
          rec.venueName.includes(p.name),
      );

      if (match?.geometry?.location) {
        rec.lat = match.geometry.location.lat;
        rec.lng = match.geometry.location.lng;
        rec.location = {
          latitude: match.geometry.location.lat,
          longitude: match.geometry.location.lng,
        };
      }
    }

    // Also attach to category cards
    for (const cat of this.categories) {
      for (const card of cat.cards) {
        const match = this.places.find(
          (p) =>
            p.name === card.venueName ||
            p.vicinity?.includes(card.venueName) ||
            card.venueName.includes(p.name),
        );

        if (match?.geometry?.location) {
          card.lat = match.geometry.location.lat;
          card.lng = match.geometry.location.lng;
          card.location = {
            latitude: match.geometry.location.lat,
            longitude: match.geometry.location.lng,
          };
        }
      }
    }

    console.log(
      'Attached coordinates to',
      this.recommendations.filter((r) => r.lat).length,
      'recommendations and',
      this.categories.reduce(
        (sum, c) => sum + c.cards.filter((c) => c.lat).length,
        0,
      ),
      'category cards',
    );
  }

  async showLockTimePicker(venue: PlannedVenue) {
    // Simple prompt for demo — replace with proper time picker later
    const time = prompt(
      `Lock "${venue.name}" at what time? (HH:MM, e.g., 14:00)`,
    );
    if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      venue.locked = true;
      venue.lockedTime = time;
      this.savePlan();

      // Regenerate to respect lock
      if (this.dayPlans.length > 0) {
        this.generateDayPlans();
      }
    }
  }

  // Check if venue is locked
  isLocked(venue: PlannedVenue): boolean {
    return !!venue.locked;
  }

  // Add these methods to travel.page.ts

  async regenerateDay(day: DayPlan) {
    if (this.isGeneratingPlans) return;

    const dayIndex = this.dayPlans.findIndex((d) => d.day === day.day);
    if (dayIndex === -1) return;

    this.isGeneratingPlans = true;
    this.generationCount++;

    try {
      const center = this.getDestinationCenter();
      const venues = this.smartPlanner.convertPlannedVenues(
        this.plannedVenues,
        center,
      );

      // Build fresh itinerary with variation
      const freshPlans = await this.smartPlanner.buildItinerary(
        venues,
        this.searchNearbyPoint.bind(this),
        this.numTripDays,
        this.recommendations,
        this.generationCount,
      );

      // Replace only this day, keep others
      if (freshPlans[dayIndex]) {
        this.dayPlans[dayIndex] = freshPlans[dayIndex];
        await this.loadDayRoute(this.dayPlans[dayIndex], dayIndex);
      }
    } finally {
      this.isGeneratingPlans = false;
    }
  }

  openDayMap(day: DayPlan) {
    if (!day.venues.length) return;

    const origin = `${day.venues[0].lat},${day.venues[0].lng}`;
    const destination = `${day.venues[day.venues.length - 1].lat},${day.venues[day.venues.length - 1].lng}`;

    const waypoints = day.venues
      .slice(1, -1)
      .map((v) => `${v.lat},${v.lng}`)
      .join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;

    if (waypoints) {
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }

    window.open(url, '_blank');
  }
  async loadDayRoute(day: DayPlan, index: number) {
    if (day.venues.length === 0) return;

    console.log(`=== loadDayRoute Day ${day.day} ===`);
    console.log(`Venues: ${day.venues.length}`);
    console.log(
      `First: ${day.venues[0]?.name}, Last: ${day.venues[day.venues.length - 1]?.name}`,
    );

    try {
      const updatedDay = await this.smartPlanner.assignTimeSlotsWithDirections(
        day,
        async (origin, destination, waypoints) => {
          console.log(
            `Calling Directions API: origin=${JSON.stringify(origin)}, dest=${JSON.stringify(destination)}, waypoints=${waypoints.length}`,
          );

          try {
            const route = (await this.routeService
              .getOptimizedRoute(origin, destination, waypoints, 'driving')
              .toPromise()) as any;

            console.log(`Directions response status:`, route?.status);
            console.log(`Directions legs count:`, route?.legs?.length);

            return route;
          } catch (err) {
            console.error(`Directions API call failed:`, err);
            return null;
          }
        },
      );

      // Copy updated properties back
      day.venues = updatedDay.venues;
      day.startTime = updatedDay.startTime;
      day.endTime = updatedDay.endTime;
      day.totalTravelMinutes = updatedDay.totalTravelMinutes;
      day.totalDurationMinutes = updatedDay.totalDurationMinutes;
      day.routeDetails = updatedDay.routeDetails;

      console.log(
        `Day ${day.day} routeDetails set:`,
        day.routeDetails ? 'YES' : 'NO',
      );
      console.log(
        `Day ${day.day} routeDetails status:`,
        day.routeDetails?.status,
      );
    } catch (err) {
      console.error(`loadDayRoute Day ${day.day} FAILED:`, err);
    }

    // Generate static map URL (moved outside try so it always runs)
    const allPoints = day.venues.map((v) => ({ lat: v.lat, lng: v.lng }));
    const routePolyline = day.routeDetails?.polyline;

    day.routeImageUrl =
      this.routeService.getStaticMapUrl(
        this.getCenter(allPoints),
        allPoints,
        undefined,
        routePolyline,
        14,
        600,
        180,
      ) + `&_cb=${Date.now()}`;

    // ENSURE routeDetails always exists for map rendering
    if (!day.routeDetails) {
      const allPoints = day.venues.map((v) => ({ lat: v.lat, lng: v.lng }));
      day.routeDetails = {
        status: 'FALLBACK',
        optimizedOrder: [],
        totalDistance: 0,
        totalDuration: 0,
        polyline: '',
        decodedPath: allPoints, // ← ALL venues, not just non-meal
        legs: [],
        bounds: this.calculateBounds(allPoints),
      } as DirectionsResponse;
    } else if (day.routeDetails.status === 'OK') {
      // If API succeeded, ensure decodedPath includes ALL venues (meals + activities)
      // The API only returns path for waypoints, but we need pins for meals too
      const allPoints = day.venues.map((v) => ({ lat: v.lat, lng: v.lng }));
      day.routeDetails.decodedPath = allPoints;
    }

    console.log(
      `Day ${day.day} complete:`,
      day.venues.map(
        (v) => `${v.startTime}-${v.endTime} ${v.name} (${v.type})`,
      ),
    );
  }

  private async searchNearbyPoint(
    lat: number,
    lng: number,
    keyword: string,
  ): Promise<
    import('../../services/smart-planner.service').PlannedVenue | null
  > {
    try {
      const result: any = await this.routeService
        .searchNearbyPoint(lat, lng, keyword)
        .toPromise();

      // DEFENSIVE: Handle undefined/null result
      if (!result) {
        console.log(
          `Nearby search returned null for ${keyword} at ${lat},${lng}`,
        );
        return null;
      }

      const places = result.places || result || [];

      if (!Array.isArray(places) || places.length === 0) {
        console.log(`No nearby ${keyword} found at ${lat},${lng}`);
        return null;
      }

      // Pick the first result
      const best = places[0];

      // DEFENSIVE: Ensure best has required fields
      if (!best || !best.location) {
        console.log(`Nearby result missing location for ${keyword}`);
        return null;
      }

      const type = this.mapKeywordToType(keyword);

      return {
        id: `nearby-${keyword}-${best.id || Date.now()}`,
        name: best.displayName || best.name || `Nearby ${keyword}`,
        lat: best.location.latitude ?? lat,
        lng: best.location.longitude ?? lng,
        type,
        durationMinutes: this.getDefaultDuration(type),
        userAdded: false,
        isDnaSuggestion: true,
        photoUrl: undefined, // Skip photos for now to avoid API key issues
        rating: best.rating,
        priceLevel: this.mapPriceLevel(best.priceLevel),
        whyThisTime: `📍 Found nearby — ${best.formattedAddress || keyword}`,
      };
    } catch (err) {
      console.error(`Nearby search failed for ${keyword}:`, err);
      return null;
    }
  }

  private mapKeywordToType(
    keyword: string,
  ): import('../../services/smart-planner.service').PlannedVenue['type'] {
    const map: Record<string, any> = {
      cafe: 'cafe',
      restaurant: 'restaurant',
      attraction: 'attraction',
      shopping: 'shopping',
      nightlife: 'nightlife',
      activity: 'activity',
    };
    return map[keyword] || 'attraction';
  }

  private getDefaultDuration(type: string): number {
    const durations: Record<string, number> = {
      cafe: 45,
      restaurant: 90,
      attraction: 150,
      shopping: 120,
      activity: 90,
      nightlife: 180,
    };
    return durations[type] || 90;
  }

  // Add this helper method to travel.page.ts
  private parseDurationText(durationText: string): number {
    let totalSeconds = 0;
    const hourMatch = durationText.match(/(\d+)\s*hour/);
    const minMatch = durationText.match(/(\d+)\s*min/);
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    return totalSeconds || 600; // fallback 10 min = 600s
  }

  private applyOptimizedOrder(
    venues: PlannedVenue[],
    order: number[],
  ): PlannedVenue[] {
    if (venues.length <= 2 || order.length === 0) return venues; // ← Fixed: order, not waypointOrder

    const origin = venues[0];
    const waypoints = venues.slice(1, -1);
    const destination = venues[venues.length - 1];

    const reorderedWaypoints = order.map((idx) => waypoints[idx]); // ← Fixed: order, not waypointOrder

    return [origin, ...reorderedWaypoints, destination];
  }

  private getCenter(points: { lat: number; lng: number }[]): {
    lat: number;
    lng: number;
  } {
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return { lat: avgLat, lng: avgLng };
  }

  openRouteInMaps(day: DayPlan) {
    if (!day.routeDetails) return;

    const venues = day.venues.filter((v) => !v.isMeal);
    if (venues.length < 2) return;

    const origin = { lat: venues[0].lat, lng: venues[0].lng };
    const destination = {
      lat: venues[venues.length - 1].lat,
      lng: venues[venues.length - 1].lng,
    };
    const waypoints = venues
      .slice(1, -1)
      .map((v) => ({ lat: v.lat, lng: v.lng }));

    this.routeService
      .getDirectionsUrl(origin, destination, waypoints)
      .subscribe((res) => {
        window.open(res.url, '_blank');
      });
  }

  async optimizeDayRoute(day: DayPlan, index: number) {
    // Force re-optimization
    day.routeOptimized = false;
    await this.loadDayRoute(day, index);
  }

  zoomMap(day: DayPlan, delta: number) {
    const currentZoom = day.mapZoom || 1;
    const newZoom = Math.max(0.5, Math.min(3, currentZoom + delta));
    day.mapZoom = Math.round(newZoom * 10) / 10; // Round to 1 decimal
  }

  resetMapZoom(day: DayPlan) {
    day.mapZoom = 1;
  }

  // Add these methods to your TravelPage class

  toggleExpand(venue: PlannedVenue) {
    venue.expanded = !venue.expanded;
  }

  async openTimePicker(venue: PlannedVenue) {
    this.selectedVenueForTime = venue;
    this.selectedTime = venue.startTime || '08:00';
    this.isTimePickerOpen = true;
  }

  confirmTimeLock() {
    if (!this.selectedVenueForTime) return;

    const venue = this.selectedVenueForTime;
    const newStartMinutes = this.timeToMinutes(this.selectedTime);
    const newEndMinutes = newStartMinutes + venue.durationMinutes;

    // Validate time range
    if (
      newStartMinutes < this.timeToMinutes('06:00') ||
      newEndMinutes > this.timeToMinutes('23:00')
    ) {
      alert('Please choose a time between 06:00 and 23:00');
      return;
    }

    // Validate: check for overlapping locks in same day (NEW)
    const day = this.dayPlans[this.activeDayIndex];
    const overlap = day.venues.find(
      (v) =>
        v.id !== venue.id &&
        v.locked &&
        v.lockedTime &&
        this.timesOverlap(
          newStartMinutes,
          newEndMinutes,
          this.timeToMinutes(v.lockedTime!),
          this.timeToMinutes(v.lockedTime!) + v.durationMinutes,
        ),
    );

    if (overlap) {
      alert(
        `Time conflict! "${overlap.name}" is already locked from ${overlap.startTime} to ${overlap.endTime}. Please choose a different time.`,
      );
      return;
    }

    // Validate: check if travel time is impossible (NEW)
    const venueIndex = day.venues.findIndex((v) => v.id === venue.id);
    const prevVenue = venueIndex > 0 ? day.venues[venueIndex - 1] : null;
    const nextVenue =
      venueIndex < day.venues.length - 1 ? day.venues[venueIndex + 1] : null;

    if (prevVenue && prevVenue.locked && prevVenue.lockedTime) {
      const prevEnd =
        this.timeToMinutes(prevVenue.lockedTime!) + prevVenue.durationMinutes;
      const travelFromPrev = this.estimateTravelMinutes(prevVenue, venue);
      const minStart = prevEnd + travelFromPrev;

      if (newStartMinutes < minStart) {
        alert(
          `Cannot start at ${this.selectedTime} — "${prevVenue.name}" ends at ${prevVenue.endTime} with ${travelFromPrev} min travel. Earliest start: ${this.minutesToTime(minStart)}`,
        );
        return;
      }
    }

    if (nextVenue && nextVenue.locked && nextVenue.lockedTime) {
      const nextStart = this.timeToMinutes(nextVenue.lockedTime!);
      const travelToNext = this.estimateTravelMinutes(venue, nextVenue);
      const maxEnd = nextStart - travelToNext;

      if (newEndMinutes > maxEnd) {
        alert(
          `Cannot end at ${this.minutesToTime(newEndMinutes)} — "${nextVenue.name}" starts at ${nextVenue.startTime} with ${travelToNext} min travel. Latest end: ${this.minutesToTime(maxEnd)}`,
        );
        return;
      }
    }

    venue.locked = true;
    venue.lockedTime = this.selectedTime;

    // Don't manually set start/end here — let assignTimeSlotsWithLegs handle it
    // Just mark as locked, then regenerate the day's schedule

    // Update in plannedVenues too
    const planned = this.plannedVenues.find(
      (v: any) => v.venueName === venue.name,
    );
    if (planned) {
      planned.locked = true;
      planned.lockedTime = this.selectedTime;
    }

    this.savePlan();
    this.isTimePickerOpen = false;
    this.selectedVenueForTime = null;

    // Re-run loadDayRoute which calls assignTimeSlotsWithDirections → assignTimeSlotsWithLegs
    // This will now RESPECT the lock and build around it
    this.loadDayRoute(this.dayPlans[this.activeDayIndex], this.activeDayIndex);
  }

  cancelTimeLock() {
    this.isTimePickerOpen = false;
    this.selectedVenueForTime = null;
  }
  // Helper methods (add if not present)
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  openInMapsForVenue(venue: PlannedVenue) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name)}&query_place_id=${venue.id}`;
    window.open(url, '_blank');
  }

  openDetailForVenue(venue: PlannedVenue) {
    // Find matching recommendation card
    const card =
      this.recommendations.find((r) => r.venueName === venue.name) ||
      this.categories
        .flatMap((c) => c.cards)
        .find((c) => c.venueName === venue.name);
    if (card) {
      this.openDetailModal(card);
    }
  }

  onRunningLate() {
    // Simple: shift all remaining venues by +30 min
    const currentDay = this.dayPlans[this.activeDayIndex];
    if (!currentDay) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Find first venue that hasn't started yet
    for (const venue of currentDay.venues) {
      if (!venue.startTime) continue;
      const [h, m] = venue.startTime.split(':').map(Number);
      const venueMinutes = h * 60 + m;
      if (venueMinutes > currentMinutes && !venue.locked) {
        // Shift this and all subsequent venues by 30 min
        const shift = 30;
        const idx = currentDay.venues.indexOf(venue);
        for (let i = idx; i < currentDay.venues.length; i++) {
          const v = currentDay.venues[i];
          if (v.startTime && v.endTime && !v.locked) {
            const [sh, sm] = v.startTime.split(':').map(Number);
            const [eh, em] = v.endTime.split(':').map(Number);
            v.startTime = this.smartPlanner['minutesToTime'](
              sh * 60 + sm + shift,
            );
            v.endTime = this.smartPlanner['minutesToTime'](
              eh * 60 + em + shift,
            );
          }
        }
        break;
      }
    }
  }

  findNearbyNow() {
    // Open maps at current location
    window.open('https://www.google.com/maps/search/nearby', '_blank');
  }

  navigateTo(venue: PlannedVenue) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
    window.open(url, '_blank');
  }

  showMenu(venue: PlannedVenue) {
    // Open Google Maps place details
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.name)}&query_place_id=${venue.id}`;
    window.open(url, '_blank');
  }

  reserveOrCall(venue: PlannedVenue) {
    // No phone on PlannedVenue, just open Google Maps
    this.showMenu(venue);
  }

  scrollToMap() {
    document.getElementById('day-map')?.scrollIntoView({ behavior: 'smooth' });
  }

  openSwapModal(venue: PlannedVenue) {
    // Simple alert for now — replace with proper modal later
    alert(`Replace "${venue.name}" — feature coming soon!`);
  }

  // ═══ MAP & NEARBY METHODS ═══

  scrollToDayMap() {
    const day = this.dayPlans[this.activeDayIndex];
    if (!day) return;
    const el = document.getElementById('day-map-' + day.day);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  browseNearby(day: DayPlan) {
    // Get center of current day's venues and open Google Maps explore
    const venues = day.venues.filter((v) => !v.isMeal);
    if (venues.length === 0) return;

    const center = this.getCenter(
      venues.map((v) => ({ lat: v.lat, lng: v.lng })),
    );
    const url = `https://www.google.com/maps/search/nearby/@${center.lat},${center.lng},15z`;
    window.open(url, '_blank');
  }

  switchDay(index: number) {
    this.activeDayIndex = index;
    // Don't clear routeDetails — it causes the map to show "Generating"
    console.log(
      `Switched to day ${index}, routeDetails:`,
      this.dayPlans[index]?.routeDetails ? 'present' : 'missing',
    );
  }

  private estimateTravelTimeMinutes(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): number {
    const R = 6371000;
    const dLat = ((to.lat - from.lat) * Math.PI) / 180;
    const dLng = ((to.lng - from.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((from.lat * Math.PI) / 180) *
        Math.cos((to.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;
    const distanceKm = distanceMeters / 1000;

    // GRAB/CAR timing in city traffic (Johor Bahru / Singapore context)
    // Base formula: ~2-3 min per km in light city traffic, plus pickup/wait time
    let minutes: number;

    if (distanceKm < 0.5) {
      // Very short: 3-5 min (pickup + short ride)
      minutes = 3 + distanceKm * 4;
    } else if (distanceKm < 2) {
      // Short: ~4 min per km + 2 min pickup
      minutes = 2 + distanceKm * 4;
    } else if (distanceKm < 5) {
      // Medium: ~3 min per km + 2 min pickup
      minutes = 2 + distanceKm * 3;
    } else if (distanceKm < 10) {
      // Longer: ~2.5 min per km + 2 min pickup
      minutes = 2 + distanceKm * 2.5;
    } else {
      // Far: highway speed ~2 min per km
      minutes = 2 + distanceKm * 2;
    }

    // Round to nearest minute, minimum 2 min
    return Math.max(2, Math.round(minutes));
  }

  private calculateBounds(points: { lat: number; lng: number }[]): {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  } {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return {
      northeast: { lat: Math.max(...lats), lng: Math.max(...lngs) },
      southwest: { lat: Math.min(...lats), lng: Math.min(...lngs) },
    };
  }

  unlockVenue(venue: PlannedVenue) {
    venue.locked = false;
    delete venue.lockedTime;

    // Update in plannedVenues too
    const planned = this.plannedVenues.find(
      (v: any) => v.venueName === venue.name,
    );
    if (planned) {
      planned.locked = false;
      delete planned.lockedTime;
    }

    this.savePlan();

    // Regenerate this day's schedule
    this.loadDayRoute(this.dayPlans[this.activeDayIndex], this.activeDayIndex);
  }

  getRestMinutes(current: PlannedVenue, next: PlannedVenue): number {
    const currentEnd = this.timeToMinutes(current.endTime || '00:00');
    const nextStart = this.timeToMinutes(next.startTime || '00:00');
    const travel = current.travelToNext || 0;
    const gap = nextStart - currentEnd - travel;
    return Math.max(0, gap);
  }

  private timesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  private estimateTravelMinutes(from: PlannedVenue, to: PlannedVenue): number {
    const distKm = this.haversine(from.lat, from.lng, to.lat, to.lng);
    if (distKm < 0.5) return 3;
    if (distKm < 2) return Math.round(2 + distKm * 4);
    if (distKm < 5) return Math.round(2 + distKm * 3);
    return Math.round(2 + distKm * 2);
  }

  private haversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async findAlternatives(venue: PlannedVenue) {
    if (!venue.isDnaSuggestion && !venue.isPlaceholder) {
      console.log(
        'Only DNA recommendations and placeholders can have alternatives',
      );
      return;
    }

    this.alternativesForVenue = venue;
    this.isAlternativesModalOpen = true;
    this.isLoadingAlternatives = true;
    this.alternativeOptions = [];

    try {
      const keyword =
        venue.type === 'cafe'
          ? 'cafe'
          : venue.type === 'restaurant'
            ? 'restaurant'
            : venue.type === 'nightlife'
              ? 'nightlife'
              : 'attraction';

      // Call the HTTP method directly, not your wrapper
      const result: any = await this.routeService
        .searchNearbyPoint(
          venue.lat,
          venue.lng,
          keyword,
          3000, // radius
        )
        .toPromise();

      // Handle the response shape from your backend
      const places = result?.places || [];

      this.alternativeOptions = places
        .filter((p: any) => p.id !== venue.id && p.displayName !== venue.name)
        .slice(0, 5)
        .map((p: any) => ({
          id: `alt-${venue.type}-${p.id || Date.now()}`,
          name: p.displayName,
          lat: p.location?.latitude ?? venue.lat,
          lng: p.location?.longitude ?? venue.lng,
          type: venue.type,
          durationMinutes: venue.durationMinutes,
          userAdded: false,
          isDnaSuggestion: true,
          // Don't construct photo URL with API key — your backend handles it
          // Or if you have a backend endpoint for photos, use that
          photoUrl: undefined,
          rating: p.rating,
          priceLevel: this.mapPriceLevel(p.priceLevel),
          whyThisTime: `📍 Alternative near ${venue.name}`,
        }));
    } catch (err) {
      console.error('Failed to load alternatives:', err);
    } finally {
      this.isLoadingAlternatives = false;
    }
  }

  selectAlternative(alt: PlannedVenue) {
    if (!this.alternativesForVenue) return;

    const day = this.dayPlans[this.activeDayIndex];
    const index = day.venues.findIndex(
      (v) => v.id === this.alternativesForVenue!.id,
    );

    if (index >= 0) {
      // Preserve locked status and time if exists
      alt.locked = this.alternativesForVenue.locked;
      alt.lockedTime = this.alternativesForVenue.lockedTime;
      alt.startTime = this.alternativesForVenue.startTime;
      alt.endTime = this.alternativesForVenue.endTime;
      alt.travelToNext = this.alternativesForVenue.travelToNext;

      // Replace in day
      day.venues[index] = alt;

      // Re-calculate route for this day
      this.loadDayRoute(day, this.activeDayIndex);
    }

    this.isAlternativesModalOpen = false;
    this.alternativesForVenue = null;
  }

  closeAlternatives() {
    this.isAlternativesModalOpen = false;
    this.alternativesForVenue = null;
  }

  // Helper if not already present
  private mapPriceLevel(level: string): number {
    const map: Record<string, number> = {
      PRICE_LEVEL_FREE: 0,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4,
    };
    return map[level] ?? 2;
  }

  getVenueTimeStatus(
    venue: PlannedVenue,
  ): 'past' | 'current' | 'upcoming' | 'future' {
    if (!venue.startTime || !venue.endTime) return 'future';

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const start = this.timeToMinutes(venue.startTime);
    const end = this.timeToMinutes(venue.endTime);

    // "Current" = within the time slot, or up to 15 min before start
    if (currentMinutes >= start - 15 && currentMinutes <= end) return 'current';
    if (currentMinutes > end) return 'past';

    // "Upcoming" = next venue after current time (only one venue gets this)
    return 'upcoming';
  }

  /** True if this venue is the first upcoming one */
  isNextUp(venue: PlannedVenue, day: DayPlan): boolean {
    const status = this.getVenueTimeStatus(venue);
    if (status !== 'upcoming') return false;

    // Check if any earlier venue is also upcoming (shouldn't happen, but safety)
    const venueIndex = day.venues.findIndex((v) => v.id === venue.id);
    for (let i = 0; i < venueIndex; i++) {
      if (this.getVenueTimeStatus(day.venues[i]) === 'upcoming') return false;
    }
    return true;
  }

  /** Minutes until this venue starts */
  getMinutesUntil(venue: PlannedVenue): number | null {
    if (!venue.startTime) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const start = this.timeToMinutes(venue.startTime);
    const diff = start - currentMinutes;
    return diff > 0 ? diff : null;
  }

  // ═══ TIME FORMATTING ═══

  formatMinutes(minutes: number | null): string {
    if (minutes === null || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  // ═══ NEARBY SUGGESTIONS ═══
  getNearbySuggestions(
    venue: PlannedVenue,
  ): Array<{ name: string; distance: number; type: string; isDna: boolean }> {
    const key = `${venue.name}|${venue.lat.toFixed(5)}|${venue.lng.toFixed(5)}`;

    // Return cached if exists
    const cached = this.nearbyCache.get(key);
    if (cached) return cached;

    // Build fresh
    const nearby: Array<{
      name: string;
      distance: number;
      type: string;
      isDna: boolean;
    }> = [];
    const seen = new Set<string>(); // ← FIX: dedupe by normalized name

    const addIfNew = (
      name: string,
      distance: number,
      type: string,
      isDna: boolean,
    ) => {
      const normalized = name.toLowerCase().trim();
      if (seen.has(normalized)) return;
      if (normalized === venue.name.toLowerCase().trim()) return; // skip self
      seen.add(normalized);
      nearby.push({ name, distance, type, isDna });
    };

    // DNA picks within 200m
    for (const dna of this.recommendations) {
      if (!dna.lat || !dna.lng) continue;
      const dist = this.haversine(venue.lat, venue.lng, dna.lat, dna.lng);
      if (dist <= 0.2) {
        addIfNew(dna.venueName, dist, this.inferCategory(dna.venueName), true);
      }
    }

    // Places from API within 200m
    for (const place of this.places) {
      if (!place.geometry?.location) continue;
      const dist = this.haversine(
        venue.lat,
        venue.lng,
        place.geometry.location.lat,
        place.geometry.location.lng,
      );
      if (dist <= 0.2) {
        addIfNew(place.name, dist, place.types?.[0] || 'place', false);
      }
    }

    const result = nearby.sort((a, b) => a.distance - b.distance).slice(0, 3);
    this.nearbyCache.set(key, result); // ← cache it
    return result;
  }
  /** Quick check if venue is a pay-able spot */
  isPayableVenue(venue: PlannedVenue): boolean {
    return venue.type === 'restaurant' || venue.type === 'cafe';
  }

  openPaymentModalFromVenue(venue: PlannedVenue) {
    // Find matching recommendation card or build one
    const card =
      this.recommendations.find((r) => r.venueName === venue.name) ||
      ({
        venueName: venue.name,
        address: '',
        lat: venue.lat,
        lng: venue.lng,
        priceLevel: venue.priceLevel,
        rating: venue.rating,
      } as RecommendationCard);

    this.openPaymentModal(card);
  }

  precomputeNearbySuggestions() {
    this.nearbyCache.clear();
    for (const day of this.dayPlans) {
      for (const venue of day.venues) {
        const key = `${venue.name}|${venue.lat.toFixed(5)}|${venue.lng.toFixed(5)}`;
        this.nearbyCache.set(key, this.computeNearbyForVenue(venue));
      }
    }
  }

  private computeNearbyForVenue(
    venue: PlannedVenue,
  ): Array<{ name: string; distance: number; type: string; isDna: boolean }> {
    const nearby: Array<{
      name: string;
      distance: number;
      type: string;
      isDna: boolean;
    }> = [];
    const seenNames = new Set<string>();

    const addIfUnique = (
      name: string,
      distance: number,
      type: string,
      isDna: boolean,
    ) => {
      const normalized = name.toLowerCase().trim();
      if (seenNames.has(normalized)) return;
      if (normalized === venue.name.toLowerCase().trim()) return;
      seenNames.add(normalized);
      nearby.push({ name, distance, type, isDna });
    };

    // DNA picks within 200m
    for (const dna of this.recommendations) {
      if (!dna.lat || !dna.lng) continue;
      const dist = this.haversine(venue.lat, venue.lng, dna.lat, dna.lng);
      if (dist <= 0.2) {
        addIfUnique(
          dna.venueName,
          dist,
          this.inferCategory(dna.venueName),
          true,
        );
      }
    }

    // Places from API within 200m
    for (const place of this.places) {
      if (!place.geometry?.location) continue;
      const dist = this.haversine(
        venue.lat,
        venue.lng,
        place.geometry.location.lat,
        place.geometry.location.lng,
      );
      if (dist <= 0.2) {
        addIfUnique(place.name, dist, place.types?.[0] || 'place', false);
      }
    }

    return nearby.sort((a, b) => a.distance - b.distance).slice(0, 3);
  }
}
