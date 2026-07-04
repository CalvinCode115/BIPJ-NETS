export interface DnaProfile {
  userId: string;
  traits: string[];
  topCategories: { category: string; amount: number; share: number }[];
  topMerchants: string[];
  avgDailySpend: number;
  travelHints: {
    preferredCuisines: string[];
    budgetStyle: 'budget' | 'moderate' | 'premium';
    typicalTripSpend: number;
  };
  updatedAt: string;
}

export interface GooglePlace {
  name: string;
  place_id: string;
  vicinity: string;
  rating: number;
  user_ratings_total: number;
  price_level?: number;
  photos?: { name: string }[];
  geometry: {
    location: { lat: number; lng: number };
  };
}

export interface RecommendationCard {
  title: string;
  description: string;
  venueName: string;
  rating: number;
  reviewCount: number;
  priceLevel: number;
  address: string;
  photoUrl?: string;
  isHero?: boolean;
}

export interface GeminiResponse {
  hero: {
    title: string;
    description: string;
    venueName: string;
  };
  cards: {
    title: string;
    description: string;
    venueName: string;
  }[];
}

// FX Tracker types (used by Travel page FX circle)
export interface FxRate {
  date: string;
  rate: number;
}

export interface FxInsight {
  currentRate: number;
  previousRate: number;
  changePercent: number;
  trend: 'up' | 'down' | 'flat';
  high30d: number;
  low30d: number;
  average30d: number;
  rates: FxRate[];
}

// Weather
export interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
  humidity: number;
}

// Budget
export interface BudgetTracker {
  typicalTripSpend: number;
  spentSoFar: number;
  remaining: number;
  percentage: number;
}

// Category Section
export interface CategorySection {
  title: string;
  icon: string;
  cards: RecommendationCard[];
}

export interface TravelTransaction {
  id: string;
  venueName: string;
  amount: number;
  timestamp: string;
  cardLabel: string;
}

// BudgetTracker already exists — keep it
export interface BudgetTracker {
  spentSoFar: number;
  typicalTripSpend: number;
  remaining: number;
  percentage: number;
}

export interface CategorySection {
  title: string;
  cards: RecommendationCard[];
  visibleCount: number;  // ← ADD THIS
}