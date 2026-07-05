import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  DnaProfile, GooglePlace, RecommendationCard,
  CategorySection, BudgetTracker
} from './travel.model';

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

  constructor(private http: HttpClient) { }

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
        const allQueries = this.buildAllQueries(dna);
        const placesCalls = allQueries.map(q => this.searchPlaces(q.query, q.category));

        return forkJoin(placesCalls).pipe(
          map(results => {
            // Flatten and deduplicate
            const allPlaces: { place: GooglePlace; category: string }[] = [];
            results.forEach((places, i) => {
              places.forEach(p => allPlaces.push({ place: p, category: allQueries[i].category }));
            });

            const seen = new Set<string>();
            const uniquePlaces = allPlaces.filter(({ place }) => {
              if (seen.has(place.place_id)) return false;
              seen.add(place.place_id);
              return true;
            });

            return { dna, uniquePlaces };
          }),
          map(({ dna, uniquePlaces }) => {
            // Score and rank all places
            const scored = this.scoreAndRankPlaces(uniquePlaces, dna);

            // Top 5 become DNA Picks (hero + 4)
            const dnaPicks = this.buildDnaPicks(scored.slice(0, 5), dna);

            // Rest go to categories
            const categories = this.buildCategorySections(scored.slice(5), dna);

            const budget = this.buildBudgetTracker(dna);

            return { dnaPicks, categories, budget };
          })
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

    // DNA-matched queries
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

    // Always add variety
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
      maxResultCount: 10,
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
      maxResultCount: 10,
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
      },
      regularOpeningHours: p.regularOpeningHours ? {
        openNow: p.regularOpeningHours.openNow,
        periods: p.regularOpeningHours.periods
      } : undefined,
      types: p.types || []
    };
  }

  private parsePriceLevel(level: string): number {
    const match = level.match(/\d/);
    return match ? parseInt(match[0]) : 0;
  }

  // ========== SMART RANKING ENGINE ==========

  private scoreAndRankPlaces(
    places: { place: GooglePlace; category: string }[],
    dna: DnaProfile
  ): { place: GooglePlace; category: string; score: number; whyMatch: string[]; distance: number }[] {

    const budgetStyle = dna.travelHints.budgetStyle;
    const targetPrice = this.getTargetPriceLevel(budgetStyle);
    const usualSpend = dna.travelHints.usualMealSpend || this.estimateUsualSpend(budgetStyle);
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    const scored = places.map(({ place, category }) => {
      let score = 0;
      const whyMatch: string[] = [];

      // 1. PRICE MATCH (0-40 points)
      const priceDiff = Math.abs((place.price_level || 2) - targetPrice);
      if (priceDiff === 0) {
        score += 40;
        whyMatch.push('💰 Perfect price match');
      } else if (priceDiff === 1) {
        score += 25;
        whyMatch.push('💰 Good value');
      } else if (priceDiff === 2) {
        score += 10;
      }

      // 2. RATING QUALITY (0-25 points)
      if (place.rating >= 4.5) {
        score += 25;
        whyMatch.push('⭐ Top rated');
      } else if (place.rating >= 4.0) {
        score += 20;
        whyMatch.push('⭐ Highly rated');
      } else if (place.rating >= 3.5) {
        score += 12;
      }

      // 3. REVIEW POPULARITY (0-15 points)
      if (place.user_ratings_total > 500) {
        score += 15;
        whyMatch.push('🔥 Local favorite');
      } else if (place.user_ratings_total > 100) {
        score += 10;
      } else if (place.user_ratings_total > 20) {
        score += 5;
      }

      // 4. OPENING HOURS MATCH (0-15 points)
      const hoursMatch = this.checkHoursMatch(place, currentDay, currentHour);
      if (hoursMatch === 'open_now') {
        score += 15;
        whyMatch.push('🕐 Open now');
      } else if (hoursMatch === 'opens_soon') {
        score += 8;
        whyMatch.push('🕐 Opens soon');
      }

      // 5. DISTANCE (0-5 points) — closer is better
      const dist = this.calculateDistance(
        this.DESTINATION.lat, this.DESTINATION.lng,
        place.geometry.location.lat, place.geometry.location.lng
      );
      if (dist < 1000) score += 5;
      else if (dist < 2500) score += 3;
      else if (dist < 5000) score += 1;

      return { place, category, score, whyMatch, distance: dist };
    });

    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  private getTargetPriceLevel(budgetStyle: string): number {
    switch (budgetStyle) {
      case 'budget': return 1;
      case 'premium': return 4;
      default: return 2; // moderate
    }
  }

  private estimateUsualSpend(budgetStyle: string): number {
    switch (budgetStyle) {
      case 'budget': return 8;
      case 'premium': return 45;
      default: return 18; // moderate
    }
  }

  private checkHoursMatch(place: GooglePlace, day: number, hour: number): string {
    if (!place.regularOpeningHours?.periods) return 'unknown';

    // Check if open now
    if (place.regularOpeningHours.openNow) return 'open_now';

    // Check if opens within 2 hours
    const todayPeriods = place.regularOpeningHours.periods.filter(
      p => p.open.day === day
    );

    for (const period of todayPeriods) {
      const openHour = period.open.hour;
      if (hour < openHour && openHour - hour <= 2) return 'opens_soon';
    }

    return 'closed';
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ========== BUILD DNA PICKS (Top 5) ==========

  private buildDnaPicks(
    topScored: { place: GooglePlace; category: string; score: number; whyMatch: string[]; distance: number }[],
    dna: DnaProfile
  ): RecommendationCard[] {

    const trait = dna.traits[0] || 'traveller';
    const budget = dna.travelHints.budgetStyle;

    return topScored.map((item, index) => {
      const place = item.place;
      const isHero = index === 0;

      // Generate smart title
      let title: string;
      if (isHero) {
        if (item.whyMatch.includes('⭐ Top rated')) title = `Top Pick for ${trait}s`;
        else if (item.whyMatch.includes('🔥 Local favorite')) title = `Local Favorite`;
        else if (item.whyMatch.includes('💰 Perfect price match')) title = `Best Value Match`;
        else title = `Perfect for ${trait}s`;
      } else {
        if (place.rating >= 4.5) title = `Rated ${place.rating}★`;
        else if (item.whyMatch.includes('🕐 Open now')) title = `Open Now`;
        else title = place.name;
      }

      // Generate description with DNA context
      const descParts: string[] = [];

      // DNA hook
      if (isHero) {
        descParts.push(`Your DNA shows you're a ${trait}.`);
      }

      // Venue facts
      const priceText = place.price_level ? '💰'.repeat(place.price_level) : '';
      descParts.push(`${place.name} scores ${place.rating}★ with ${place.user_ratings_total} reviews${priceText ? ` · ${priceText}` : ''}.`);

      // Why this matches
      const topReasons = item.whyMatch.filter(r => !r.includes('⭐') || place.rating < 4.5).slice(0, 2);
      if (topReasons.length > 0 && !isHero) {
        descParts.push(topReasons.join(' · '));
      }

      // Distance
      if (item.distance < 1000) {
        descParts.push(`Only ${Math.round(item.distance)}m away.`);
      }

      return {
        title,
        description: descParts.join(' '),
        venueName: place.name,
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        priceLevel: place.price_level || 0,
        address: place.vicinity,
        photoUrl: this.getPhotoUrl(place),
        isHero,
        distance: item.distance,
        openNow: item.whyMatch.includes('🕐 Open now'),
        dnaMatchScore: item.score,
        whyMatch: item.whyMatch
      };
    });
  }

  // ========== BUILD CATEGORY SECTIONS ==========

  private buildCategorySections(
    remaining: { place: GooglePlace; category: string; score: number; whyMatch: string[]; distance: number }[],
    dna: DnaProfile
  ): CategorySection[] {

    const trait = dna.traits[0] || 'traveller';
    const budget = dna.travelHints.budgetStyle;

    // Group by category
    const grouped: { [key: string]: typeof remaining } = {};
    remaining.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
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

    Object.entries(grouped).forEach(([category, items]) => {
      const config = categoryConfig[category] || { title: category, icon: 'compass' };

      const cards: RecommendationCard[] = items.slice(0, 9).map((item, i) => {
        const place = item.place;
        const isTopPick = i === 0;

        // Generate contextual description
        const descParts: string[] = [];

        if (isTopPick) {
          descParts.push(`Top match for your ${trait} DNA.`);
        }

        descParts.push(`${place.rating}★ · ${place.user_ratings_total} reviews`);

        // Add match reasons
        const reasons = item.whyMatch.filter(r => r !== '🕐 Open now').slice(0, 2);
        if (reasons.length > 0) {
          descParts.push(reasons.join(' · '));
        }

        // Price context
        const estimatedSpend = this.estimateSpendAtVenue(place.price_level, budget);
        if (estimatedSpend) {
          descParts.push(`~$${estimatedSpend} per person`);
        }

        return {
          title: isTopPick ? `Best ${config.title.split(' ')[1] || 'Pick'}` : place.name,
          description: descParts.join(' · '),
          venueName: place.name,
          rating: place.rating,
          reviewCount: place.user_ratings_total,
          priceLevel: place.price_level || 0,
          address: place.vicinity,
          photoUrl: this.getPhotoUrl(place),
          distance: item.distance,
          openNow: item.whyMatch.includes('🕐 Open now'),
          dnaMatchScore: item.score,
          whyMatch: item.whyMatch
        };
      });

      if (cards.length > 0) {
        sections.push({ title: config.title, icon: config.icon, cards, visibleCount: 3 });
      }
    });

    // Sort sections by average DNA match score
    return sections.sort((a, b) => {
      const avgA = a.cards.reduce((sum, c) => sum + (c.dnaMatchScore || 0), 0) / a.cards.length;
      const avgB = b.cards.reduce((sum, c) => sum + (c.dnaMatchScore || 0), 0) / b.cards.length;
      return avgB - avgA;
    });
  }

  private estimateSpendAtVenue(priceLevel?: number, budgetStyle?: string): number | null {
    if (!priceLevel) return null;
    const base = priceLevel * 8; // rough estimate
    if (budgetStyle === 'budget') return Math.round(base * 0.7);
    if (budgetStyle === 'premium') return Math.round(base * 1.5);
    return base;
  }

  // ========== BUDGET TRACKER ==========

  private buildBudgetTracker(dna: DnaProfile): BudgetTracker {
    const typical = dna.travelHints.typicalTripSpend;
    const spentRatio = 0.35 + Math.random() * 0.3;
    const spent = Math.round(typical * spentRatio);
    return {
      typicalTripSpend: typical,
      spentSoFar: spent,
      remaining: typical - spent,
      percentage: Math.round(spentRatio * 100)
    };
  }

  // ========== HELPERS ==========

  private getPhotoUrl(place: GooglePlace): string | undefined {
    if (place.photos && place.photos.length > 0) {
      const photoName = (place.photos[0] as any).name;
      if (photoName) {
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