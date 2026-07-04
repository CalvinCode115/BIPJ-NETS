import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  DnaProfile, GooglePlace, RecommendationCard, GeminiResponse,
  CategorySection, BudgetTracker
} from './travel.model';

export interface TravelRequest {
  destination: string;
  days: number;
  interests: string;
}

export interface TravelResponse {
  itinerary: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class TravelService {

  private readonly DESTINATION = {
    name: 'Johor Bahru, Malaysia',
    lat: 1.4927,
    lng: 103.7414,
    radius: 5000
  };

  private readonly BACKEND_URL = 'http://localhost:3000/api';
  private readonly CACHE_KEY = 'nets_travel_recs';
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly apiUrl = 'http://localhost:8000/api/travel-plan';

  constructor(private http: HttpClient) { }
  generatePlan(request: TravelRequest): Observable<TravelResponse> {
    return this.http.post<TravelResponse>(this.apiUrl, request);
  }
  // ========== MAIN PIPELINE ==========

  getDnaProfile(userId: string, month?: number, year?: number): Observable<DnaProfile> {
    let url = `${this.BACKEND_URL}/users/${userId}/dna-profile`;
    const params: any = {};
    if (month) params.month = month;
    if (year) params.year = year;
    return this.http.get<DnaProfile>(url, { params }).pipe(
      catchError(err => {
        console.error('DNA fetch failed:', err);
        return throwError(() => new Error('Failed to load your travel DNA'));
      })
    );
  }

  getTravelRecommendations(userId: string, month?: number, year?: number): Observable<{
    dnaPicks: RecommendationCard[],
    categories: CategorySection[],
    budget: BudgetTracker
  }> {
    const cacheKey = `${this.CACHE_KEY}_${userId}_${month}_${year}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      console.log('[Travel] Using cached recommendations');
      return of(cached);
    }

    return this.getDnaProfile(userId, month, year).pipe(
      switchMap(dna => {
        // Fetch all category searches in parallel
        const allQueries = this.buildAllQueries(dna);
        const placesCalls = allQueries.map(q => this.searchPlaces(q.query, q.category));

        return forkJoin(placesCalls).pipe(
          map(results => {
            // Flatten all places
            const allPlaces: { place: GooglePlace; category: string }[] = [];
            results.forEach((places, i) => {
              places.forEach(p => allPlaces.push({ place: p, category: allQueries[i].category }));
            });

            // Deduplicate
            const seen = new Set<string>();
            const uniquePlaces = allPlaces.filter(({ place }) => {
              if (seen.has(place.place_id)) return false;
              seen.add(place.place_id);
              return true;
            });

            // Split: top 5 for Gemini, rest for templates
            const geminiPlaces = uniquePlaces.slice(0, 5).map(p => p.place);
            const templatePlaces = uniquePlaces.slice(5);

            return { dna, geminiPlaces, templatePlaces };
          }),
          switchMap(({ dna, geminiPlaces, templatePlaces }) =>
            this.getGeminiRecommendations(dna, geminiPlaces).pipe(
              map(dnaPicks => {
                // Build category sections from template places
                const categories = this.buildCategorySections(templatePlaces, dna);
                const budget = this.buildBudgetTracker(dna);
                return { dnaPicks, categories, budget };
              })
            )
          )
        );
      }),
      map(result => {
        this.setCache(cacheKey, result);
        return result;
      })
    );
  }

  // ========== PLACES API ==========

  private buildAllQueries(dna: DnaProfile): { query: string; category: string }[] {
    const queries: { query: string; category: string }[] = [];
    const traits = dna.traits.map(t => t.toLowerCase());
    const cuisines = dna.travelHints.preferredCuisines.map(c => c.toLowerCase());

    const hasCoffee = traits.some(t => t.includes('coffee'));
    const hasFoodie = traits.some(t => t.includes('food') || t.includes('dining'));
    const hasTravel = traits.some(t => t.includes('travel'));
    const hasShopper = traits.some(t => t.includes('shopper'));
    const hasWellness = traits.some(t => t.includes('wellness'));

    // DNA-matched queries (for Gemini picks)
    if (hasCoffee || cuisines.includes('coffee')) {
      queries.push({ query: 'cafe', category: 'coffee' });
    }
    if (hasFoodie) {
      if (cuisines.includes('chinese')) queries.push({ query: 'chinese restaurant', category: 'food' });
      else if (cuisines.includes('local dining')) queries.push({ query: 'local food restaurant', category: 'food' });
      else queries.push({ query: 'restaurant', category: 'food' });
    }
    if (hasTravel) queries.push({ query: 'tourist attraction', category: 'attractions' });
    if (hasShopper) queries.push({ query: 'shopping mall', category: 'shopping' });
    if (hasWellness) queries.push({ query: 'spa', category: 'wellness' });

    // Always add these categories for variety
    queries.push({ query: 'museum', category: 'culture' });
    queries.push({ query: 'night market', category: 'nightlife' });
    queries.push({ query: 'hawker centre', category: 'food' });
    queries.push({ query: 'bakery', category: 'food' });

    return queries;
  }

  private searchPlaces(query: string, category: string): Observable<GooglePlace[]> {
    const useTextSearch = query.includes(' ');
    if (useTextSearch) {
      return this.searchText(query);
    }
    return this.searchNearby(query);
  }

private searchNearby(keyword: string): Observable<GooglePlace[]> {
    return this.http.post<any>('http://localhost:8000/api/places/nearby', {
      includedTypes: [keyword],
      maxResultCount: 9,
      lat: this.DESTINATION.lat,
      lng: this.DESTINATION.lng,
      radius: this.DESTINATION.radius
    }).pipe(
      map(res => (res.places || []).map((p: any) => this.normalizePlace(p))),
      catchError(err => {
        console.warn('Nearby search failed:', err);
        return of([]);
      })
    );
  }

  private searchText(query: string): Observable<GooglePlace[]> {
    return this.http.post<any>('http://localhost:8000/api/places/text', {
      textQuery: `${query} in ${this.DESTINATION.name}`,
      maxResultCount: 9,
      lat: this.DESTINATION.lat,
      lng: this.DESTINATION.lng,
      radius: this.DESTINATION.radius
    }).pipe(
      map(res => (res.places || []).map((p: any) => this.normalizePlace(p))),
      catchError(err => {
        console.warn('Text search failed:', err);
        return of([]);
      })
    );
  }

  private normalizePlace(p: any): GooglePlace {
    return {
      name: p.displayName?.text || p.name || 'Unknown',
      place_id: p.id || p.place_id,
      vicinity: p.formattedAddress || p.vicinity || '',
      rating: p.rating || 0,
      user_ratings_total: p.userRatingCount || 0,
      price_level: p.priceLevel ? this.parsePriceLevel(p.priceLevel) : undefined,
      photos: p.photos || [],
      geometry: {
        location: {
          lat: p.location?.latitude || 0,
          lng: p.location?.longitude || 0
        }
      }
    };
  }

  private parsePriceLevel(level: string): number {
    const match = level.match(/\d/);
    return match ? parseInt(match[0]) : 0;
  }

  // ========== GEMINI (1 CALL ONLY) ==========

  private getGeminiRecommendations(dna: DnaProfile, places: GooglePlace[]): Observable<RecommendationCard[]> {
    if (places.length === 0) {
      return of([this.getFallbackCard(dna)]);
    }

    const prompt = this.buildGeminiPrompt(dna, places);

    return this.callGemini(prompt).pipe(
      map(response => this.mergeGeminiWithPlaces(response, places)),
      catchError(err => {
        console.warn('Gemini failed, using template fallback:', err);
        return of(this.buildFallbackCards(dna, places));
      })
    );
  }

  private buildGeminiPrompt(dna: DnaProfile, places: GooglePlace[]): string {
    const topCats = dna.topCategories.map(c => `${c.category} ($${c.amount.toFixed(2)}, ${(c.share * 100).toFixed(0)}%)`).join(', ');
    const budget = dna.travelHints.budgetStyle;
    const cuisines = dna.travelHints.preferredCuisines.join(', ');

    const placesText = places.map((p, i) =>
      `${i + 1}. ${p.name} - ${p.rating}★, ${p.user_ratings_total} reviews, price level ${p.price_level || 'unknown'}, address: ${p.vicinity}`
    ).join('\n');

    return `You are NETS Beyond, a witty Gen Z travel concierge for Singaporeans visiting Malaysia.

A user with this spending DNA is visiting Johor Bahru:
- Traits: ${dna.traits.join(', ')}
- Top spending: ${topCats}
- Budget style: ${budget}
- Preferred cuisines: ${cuisines}
- Typical trip budget: $${dna.travelHints.typicalTripSpend.toFixed(0)}

Here are real venues from Google Places:
${placesText}

Pick the 5 best matches for this user's DNA and write personalized recommendations.

Return ONLY a JSON object in this exact format:
{
  "hero": {
    "title": "catchy headline, max 6 words",
    "description": "2 sentences, reference their actual spending habits. Tone: fun, confident, not cringe. Start with 'Your DNA says...'",
    "venueName": "exact name from the list"
  },
  "cards": [
    {
      "title": "short headline, max 5 words",
      "description": "1-2 sentences, personalized",
      "venueName": "exact name from the list"
    },
    {
      "title": "short headline, max 5 words",
      "description": "1-2 sentences, personalized",
      "venueName": "exact name from the list"
    },
    {
      "title": "short headline, max 5 words",
      "description": "1-2 sentences, personalized",
      "venueName": "exact name from the list"
    },
    {
      "title": "short headline, max 5 words",
      "description": "1-2 sentences, personalized",
      "venueName": "exact name from the list"
    }
  ]
}

Rules:
- Each description must reference at least one real trait or category from their DNA
- If they're budget-conscious, highlight value. If premium, highlight quality.
- Do not invent venues. Use exact names from the list above.
- Keep descriptions under 140 characters each.
- Return valid JSON only, no markdown.`;
  }

private callGemini(prompt: string): Observable<GeminiResponse> {
  // Now talks to YOUR backend, not Google directly
  return this.http.post<any>('http://localhost:8000/api/gemini', { prompt }).pipe(
    map(res => {
      const text = res.text || '{}';
      const clean = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean) as GeminiResponse;
    }),
    catchError(err => {
      console.error('Backend Gemini error:', err);
      return throwError(() => err);
    })
  );
}

  private mergeGeminiWithPlaces(gemini: GeminiResponse, places: GooglePlace[]): RecommendationCard[] {
    const cards: RecommendationCard[] = [];
    const heroPlace = places.find(p => p.name === gemini.hero.venueName) || places[0];
    if (heroPlace && gemini.hero) {
      cards.push({
        title: gemini.hero.title,
        description: gemini.hero.description,
        venueName: heroPlace.name,
        rating: heroPlace.rating,
        reviewCount: heroPlace.user_ratings_total,
        priceLevel: heroPlace.price_level || 0,
        address: heroPlace.vicinity,
        photoUrl: this.getPhotoUrl(heroPlace),
        isHero: true
      });
    }
    gemini.cards?.forEach(card => {
      const place = places.find(p => p.name === card.venueName);
      if (place) {
        cards.push({
          title: card.title,
          description: card.description,
          venueName: place.name,
          rating: place.rating,
          reviewCount: place.user_ratings_total,
          priceLevel: place.price_level || 0,
          address: place.vicinity,
          photoUrl: this.getPhotoUrl(place),
          isHero: false
        });
      }
    });
    return cards;
  }

  // ========== TEMPLATE ENGINE (FREE, SCALABLE) ==========

  private buildCategorySections(
    places: { place: GooglePlace; category: string }[],
    dna: DnaProfile
  ): CategorySection[] {
    const trait = dna.traits[0] || 'traveller';
    const budget = dna.travelHints.budgetStyle;

    // Group by category
    const grouped: { [key: string]: GooglePlace[] } = {};
    places.forEach(({ place, category }) => {
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(place);
    });

    const categoryConfig: { [key: string]: { title: string; icon: string } } = {
      coffee: { title: '☕ Coffee Spots', icon: 'cafe' },
      food: { title: '🍜 Local Eats', icon: 'restaurant' },
      attractions: { title: '🎭 Must-See Spots', icon: 'camera' },
      shopping: { title: '🛍️ Shopping', icon: 'bag' },
      wellness: { title: '✨ Wellness', icon: 'sparkles' },
      culture: { title: '🏛️ Culture & Museums', icon: 'book' },
      nightlife: { title: '🌙 Nightlife', icon: 'moon' }
    };

    const sections: CategorySection[] = [];

    Object.entries(grouped).forEach(([category, categoryPlaces]) => {
      const config = categoryConfig[category] || { title: category, icon: 'compass' };
      const cards: RecommendationCard[] = categoryPlaces.slice(0, 9).map((p, i) => ({
        title: i === 0 ? `Top Pick` : p.name,
        description: i === 0
          ? `Your DNA says you're a ${trait}. ${p.name} is a top-rated ${category} spot — ${p.rating}★ with ${p.user_ratings_total} reviews.`
          : `${p.name} — ${p.rating}★, ${p.user_ratings_total} reviews. Fits your ${budget} budget.`,
        venueName: p.name,
        rating: p.rating,
        reviewCount: p.user_ratings_total,
        priceLevel: p.price_level || 0,
        address: p.vicinity,
        photoUrl: this.getPhotoUrl(p),
        category
      }));

      if (cards.length > 0) {
        sections.push({ title: config.title, icon: config.icon, cards, visibleCount: 3 });
      }
    });

    return sections;
  }

  // ========== BUDGET TRACKER ==========

  private buildBudgetTracker(dna: DnaProfile): BudgetTracker {
    const typical = dna.travelHints.typicalTripSpend;
    // Mock: simulate user has spent 35-65% of budget
    const spentRatio = 0.35 + Math.random() * 0.3;
    const spent = Math.round(typical * spentRatio);
    return {
      typicalTripSpend: typical,
      spentSoFar: spent,
      remaining: typical - spent,
      percentage: Math.round(spentRatio * 100)
    };
  }

  // ========== FALLBACKS ==========

  private buildFallbackCards(dna: DnaProfile, places: GooglePlace[]): RecommendationCard[] {
    const trait = dna.traits[0] || 'traveller';
    return places.slice(0, 5).map((p, i) => ({
      title: i === 0 ? `Perfect for ${trait}s` : p.name,
      description: i === 0
        ? `Your DNA says you're a ${trait}. ${p.name} matches your vibe.`
        : `${p.name} — ${p.rating}★, ${p.user_ratings_total} reviews.`,
      venueName: p.name,
      rating: p.rating,
      reviewCount: p.user_ratings_total,
      priceLevel: p.price_level || 0,
      address: p.vicinity,
      photoUrl: this.getPhotoUrl(p),
      isHero: i === 0
    }));
  }

  private getFallbackCard(dna: DnaProfile): RecommendationCard {
    return {
      title: 'Explore Johor Bahru',
      description: `Your DNA says you're a ${dna.traits[0] || 'curious traveller'}.`,
      venueName: 'Johor Bahru',
      rating: 0,
      reviewCount: 0,
      priceLevel: 0,
      address: 'Malaysia',
      isHero: true
    };
  }

  // ========== HELPERS ==========

private getPhotoUrl(place: GooglePlace): string | undefined {
    if (place.photos && place.photos.length > 0) {
      const photoName = (place.photos[0] as any).name;
      if (photoName) {
        // Proxy through backend — key is hidden
        return `http://localhost:8000/api/photo?photo_name=${encodeURIComponent(photoName)}`;
      }
    }
    return undefined;
  }

  // ========== CACHE ==========

  private getCache(key: string): any | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp > this.CACHE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  private setCache(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
    } catch {
      // Storage full
    }
  }
}