export interface DnaProfile {
  userId: string;
  traits: string[];
  topCategories: { category: string; amount: number; share: number }[];
  travelHints: {
    preferredCuisines: string[];
    budgetStyle: 'budget' | 'moderate' | 'premium';
    typicalTripSpend: number;
    usualMealSpend?: number; // NEW: average spend per meal
    preferredTime?: string; // NEW: morning/afternoon/evening/night
  };
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
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: {
      open: { day: number; hour: number; minute: number };
      close: { day: number; hour: number; minute: number };
    }[];
  };
  types?: string[];
}

export interface RecommendationCard {
  title: string;
  description: string;
  venueName: string;
  rating?: number;
  reviewCount: number;
  priceLevel?: number;
  address: string;
  types?: string[];
  photoUrl?: string;
  isHero?: boolean;
  distance?: number; // meters from center
  openNow?: boolean;
  dnaMatchScore?: number;
  whyMatch: string[]; // badges like ["💰 Fits budget", "☕ Coffee DNA", "🕐 Open now"]
  lat?: number;
  lng?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface CategorySection {
  title: string;
  icon: string;
  cards: RecommendationCard[];
  visibleCount: number;
}

export interface BudgetTracker {
  spentSoFar: number;
  typicalTripSpend: number;
  remaining: number;
  percentage: number;
}

export interface GeminiResponse {
  hero: { title: string; description: string; venueName: string };
  cards: { title: string; description: string; venueName: string }[];
}

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

export interface TravelTransaction {
  id: string;
  venueName: string;
  amount: number;
  timestamp: string;
  cardLabel: string;
  category?: string;
}
// Weather
export interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
  humidity: number;
}

// Add this interface if you want
export interface TravelRecommendationsResult {
  dnaPicks: RecommendationCard[];
  categories: CategorySection[];
  budget: BudgetTracker;
  places: GooglePlace[];
}