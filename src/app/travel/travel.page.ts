import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TravelService } from './travel.service';
import { WeatherService } from './weather.service';
import { FxTrackerService } from '../fx-tracker/fx-tracker.service';
import {
  RecommendationCard, CategorySection, BudgetTracker,
  WeatherData, FxInsight
} from './travel.model';

@Component({
  selector: 'app-travel',
  templateUrl: './travel.page.html',
  styleUrls: ['./travel.page.scss'],
  standalone: false
})
export class TravelPage implements OnInit {
  // Travel
  dnaPicks: RecommendationCard[] = [];
  categories: CategorySection[] = [];
  isLoading = false;
  error: string | null = null;
  userId = 'user_1';
  destination = 'Johor Bahru, Malaysia';

  // Weather
  weather: WeatherData | null = null;

  // Budget
  budget: BudgetTracker | null = null;

  // FX FAB
  fxInsight: FxInsight | null = null;

  // Load more
  hasMoreCategories = true;
  loadedCategories = 3;

  constructor(
    private travelService: TravelService,
    private weatherService: WeatherService,
    private fxService: FxTrackerService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadAll();
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
        next: (result) => {
          this.dnaPicks = result.dnaPicks;
          this.categories = result.categories;
          this.budget = result.budget;
          this.isLoading = false;
        },
        error: (err) => {
          this.error = err.message || 'Something went wrong';
          this.isLoading = false;
        }
      });
  }

  loadMoreCategories() {
    this.loadedCategories += 2;
    if (this.loadedCategories >= this.categories.length) {
      this.hasMoreCategories = false;
    }
  }

  // ========== WEATHER ==========

  loadWeather() {
    this.weatherService.getWeather().subscribe({
      next: (w) => this.weather = w,
      error: (err) => console.error('Weather load failed:', err)
    });
  }

  getWeatherIcon(): string {
    const map: { [key: string]: string } = {
      'sunny': 'sunny',
      'cloudy': 'cloudy',
      'rainy': 'rainy',
      'thunderstorm': 'thunderstorm',
      'partly-sunny': 'partly-sunny'
    };
    return map[this.weather?.icon || ''] || 'sunny';
  }

  // ========== FX FAB ==========

  loadFxCircle() {
    this.fxService.getFxInsight(7).subscribe({
      next: (insight) => this.fxInsight = insight,
      error: (err) => console.error('FX circle load failed:', err)
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

  // ========== HELPERS ==========

  refresh() {
    this.loadAll();
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

  getBudgetColor(): string {
    if (!this.budget) return '#34c759';
    if (this.budget.percentage > 80) return '#d71920';
    if (this.budget.percentage > 60) return '#ff9500';
    return '#34c759';
  }
}