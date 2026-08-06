import { Injectable } from '@angular/core';
import { DirectionsResponse } from './route.service';

export interface PlannedVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'restaurant' | 'attraction' | 'shopping' | 'activity' | 'nightlife' | 'cafe';
  durationMinutes: number;
  priceLevel?: number;
  rating?: number;
  userAdded: boolean;
  locked?: boolean;
  lockedTime?: string;
  preferredTime?: 'morning' | 'afternoon' | 'evening' | null;
  photoUrl?: string;
  startTime?: string;
  endTime?: string;
  travelToNext?: number;
  isMeal?: boolean;
  isDnaSuggestion?: boolean;
  isPlaceholder?: boolean;
  whyThisTime?: string;
  expanded?: boolean;
  category?: string;
}

export interface DayPlan {
  day: number;
  theme: string;
  venues: PlannedVenue[];
  totalDurationMinutes: number;
  totalTravelMinutes?: number;
  estimatedWalkingKm: number;
  startTime?: string;
  endTime?: string;
  routeImageUrl?: string;
  routeOptimized?: boolean;
  routeDetails?: DirectionsResponse;
  mapZoom?: number;
}

// Helper type for the nearby search callback
type NearbySearcher = (lat: number, lng: number, keyword: string) => Promise<PlannedVenue | null>;

@Injectable({ providedIn: 'root' })
export class SmartPlannerService {

  private readonly defaultDurations: Record<string, number> = {
    cafe: 45,
    restaurant: 90,
    attraction: 150,
    shopping: 120,
    activity: 90,
    nightlife: 180,
  };

  // ═══════════════════════════════════════════════════════════════
  // MAIN ENTRY: Build complete itinerary from user-added venues
  // ═══════════════════════════════════════════════════════════════
  private dnaCardToPlannedVenue(card: any): PlannedVenue | null {
    const lat = card.lat || card.location?.latitude;
    const lng = card.lng || card.location?.longitude;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.warn(`DNA card ${card.venueName} has no valid coordinates, skipping`);
      return null;
    }

    const type = this.inferType(card);

    return {
      id: `dna-${card.venueName || card.title}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: card.venueName || card.title || 'Unknown',
      lat,
      lng,
      type,
      durationMinutes: this.defaultDurations[type] || 90,
      rating: card.rating,
      priceLevel: card.priceLevel,
      userAdded: false,
      isDnaSuggestion: true,
      photoUrl: card.photoUrl,
      category: card.category,
      whyThisTime: `🧬 DNA Match: ${card.whyMatch?.[0] || 'Personalized pick'}`,
    };
  }

  // Update buildItinerary signature
  async buildItinerary(
    userVenues: PlannedVenue[],
    nearbySearcher: NearbySearcher,
    maxDays: number = 5,
    dnaRecommendations: any[] = []  // ← NEW: DNA picks from backend
  ): Promise<DayPlan[]> {

    if (!userVenues.length) return [];

    // Convert DNA recommendations to PlannedVenue pool
    let dnaPool = dnaRecommendations
      .map(c => this.dnaCardToPlannedVenue(c))
      .filter((v): v is PlannedVenue => v !== null);

    console.log(`[buildItinerary] DNA pool: ${dnaPool.length} venues with coordinates`);

    let cafes = userVenues.filter(v => v.type === 'cafe');
    let restaurants = userVenues.filter(v => v.type === 'restaurant');
    let activities = userVenues.filter(v =>
      ['attraction', 'shopping', 'activity'].includes(v.type)
    );
    let nightlifes = userVenues.filter(v => v.type === 'nightlife');

    // Also separate DNA recommendations by type
    let dnaCafes = dnaPool.filter(v => v.type === 'cafe');
    let dnaRestaurants = dnaPool.filter(v => v.type === 'restaurant');
    let dnaActivities = dnaPool.filter(v =>
      ['attraction', 'shopping', 'activity'].includes(v.type)
    );
    let dnaNightlife = dnaPool.filter(v => v.type === 'nightlife');

    const days: DayPlan[] = [];
    let dayNumber = 1;
    let lastLocation: { lat: number; lng: number } | null = null;
    // Cache: "lat,lng:type" -> venue | null
    const searchCache = new Map<string, PlannedVenue | null>();
    const CACHE_RADIUS_KM = 1.0;

    const getCacheKey = (lat: number, lng: number, type: string): string => {
      return `${lat.toFixed(3)},${lng.toFixed(3)}:${type}`;
    };

    const findInCache = (lat: number, lng: number, type: string): PlannedVenue | null | undefined => {
      for (const [key, value] of searchCache.entries()) {
        const [coords, cachedType] = key.split(':');
        if (cachedType !== type) continue;
        const [cachedLat, cachedLng] = coords.split(',').map(Number);
        const dist = this.haversine(lat, lng, cachedLat, cachedLng);
        if (dist <= CACHE_RADIUS_KM) return value;
      }
      return undefined;
    };

    const searchNearby = async (lat: number, lng: number, type: string): Promise<PlannedVenue | null> => {
      const cached = findInCache(lat, lng, type);
      if (cached !== undefined) return cached;

      console.log(`[search] ${type} near ${lat.toFixed(4)},${lng.toFixed(4)}`);
      let result = await nearbySearcher(lat, lng, type);

      // Fallback keywords
      if (!result) {
        const fallbacks: Record<string, string[]> = {
          'cafe': ['coffee_shop', 'bakery'],
          'restaurant': ['food'],
          'attraction': ['shopping', 'museum'],
          'nightlife': ['bar', 'pub']
        };
        for (const fb of (fallbacks[type] || [])) {
          if (result) break;
          console.log(`[search] fallback ${fb} near ${lat.toFixed(4)},${lng.toFixed(4)}`);
          result = await nearbySearcher(lat, lng, fb);
        }
      }

      searchCache.set(getCacheKey(lat, lng, type), result);
      console.log(`[search] ${type} result:`, result ? result.name : 'NULL');
      return result;
    };

    const findNearestDna = (dnaList: PlannedVenue[], ref: { lat: number; lng: number }): PlannedVenue | null => {
      if (!dnaList.length) return null;
      const sorted = [...dnaList].sort((a, b) => {
        const distA = this.haversine(a.lat, a.lng, ref.lat, ref.lng);
        const distB = this.haversine(b.lat, b.lng, ref.lat, ref.lng);
        return distA - distB;
      });
      return sorted[0];
    };

    // NEW: Remove used DNA venue from pool
    const removeFromDnaPool = (venue: PlannedVenue) => {
      dnaCafes = dnaCafes.filter(v => v.id !== venue.id);
      dnaRestaurants = dnaRestaurants.filter(v => v.id !== venue.id);
      dnaActivities = dnaActivities.filter(v => v.id !== venue.id);
      dnaNightlife = dnaNightlife.filter(v => v.id !== venue.id);
    };

    while (days.length < maxDays) {
      const dayVenues: PlannedVenue[] = [];
      let currentTime = this.timeToMinutes('08:00');

      const startRef: { lat: number; lng: number } = lastLocation || this.getCenter(userVenues);

      // ── 1. BREAKFAST (08:00) ──
      if (cafes.length > 0) {
        const breakfast = cafes.shift()!;
        dayVenues.push({ ...breakfast, isMeal: true, whyThisTime: `☕ Breakfast — ${breakfast.name}` });
        lastLocation = { lat: breakfast.lat, lng: breakfast.lng };
      } else {
        // PRIORITY 1: DNA recommendation
        const dnaCafe = findNearestDna(dnaCafes, startRef);
        if (dnaCafe) {
          dayVenues.push({ ...dnaCafe, isMeal: true, whyThisTime: `☕ Breakfast — ${dnaCafe.name} (DNA Match: ${dnaCafe.whyThisTime})` });
          lastLocation = { lat: dnaCafe.lat, lng: dnaCafe.lng };
          removeFromDnaPool(dnaCafe);
        } else {
          // PRIORITY 2: Nearby search fallback
          const nearbyCafe = await searchNearby(startRef.lat, startRef.lng, 'cafe');
          if (nearbyCafe) {
            dayVenues.push({ ...nearbyCafe, isMeal: true, isDnaSuggestion: true, whyThisTime: `☕ Breakfast — ${nearbyCafe.name}` });
            lastLocation = { lat: nearbyCafe.lat, lng: nearbyCafe.lng };
          }
        }
      }
      if (dayVenues.length > 0) currentTime += 55;

      // ── 2. MORNING ACTIVITIES (09:00-12:00) ──
      for (let i = 0; i < 2; i++) {
        if (currentTime >= this.timeToMinutes('12:00')) break;

        if (activities.length > 0) {
          const activity = this.findNearest(activities, lastLocation || startRef);
          activities = activities.filter(v => v.id !== activity.id);
          dayVenues.push({ ...activity, whyThisTime: `🌤️ Morning — ${activity.name}` });
          lastLocation = { lat: activity.lat, lng: activity.lng };
        } else {
          // PRIORITY 1: DNA recommendation
          const dnaActivity = findNearestDna(dnaActivities, lastLocation || startRef);
          if (dnaActivity && !dayVenues.some(v => v.id === dnaActivity.id)) {
            dayVenues.push({ ...dnaActivity, whyThisTime: `🌤️ Morning — ${dnaActivity.name} (DNA Match: ${dnaActivity.whyThisTime})` });
            lastLocation = { lat: dnaActivity.lat, lng: dnaActivity.lng };
            removeFromDnaPool(dnaActivity);
          } else {
            // PRIORITY 2: Nearby search
            const nearby = await searchNearby(lastLocation!.lat, lastLocation!.lng, 'attraction');
            if (nearby && !dayVenues.some(v => v.id === nearby.id)) {
              dayVenues.push({ ...nearby, isDnaSuggestion: true, whyThisTime: `🌤️ Morning — ${nearby.name}` });
              lastLocation = { lat: nearby.lat, lng: nearby.lng };
            }
          }
        }
        currentTime += 160;
      }

      // ── 3. LUNCH (12:00-13:30) ──
      if (restaurants.length > 0) {
        const lunch = restaurants.shift()!;
        dayVenues.push({ ...lunch, isMeal: true, whyThisTime: `🍜 Lunch — ${lunch.name}` });
        lastLocation = { lat: lunch.lat, lng: lunch.lng };
      } else {
        // PRIORITY 1: DNA recommendation
        const dnaLunch = findNearestDna(dnaRestaurants, lastLocation || startRef);
        if (dnaLunch) {
          dayVenues.push({ ...dnaLunch, isMeal: true, whyThisTime: `🍜 Lunch — ${dnaLunch.name} (DNA Match: ${dnaLunch.whyThisTime})` });
          lastLocation = { lat: dnaLunch.lat, lng: dnaLunch.lng };
          removeFromDnaPool(dnaLunch);
        } else {
          // PRIORITY 2: Nearby search
          const nearby = await searchNearby(lastLocation!.lat, lastLocation!.lng, 'restaurant');
          if (nearby && !dayVenues.some(v => v.id === nearby.id)) {
            dayVenues.push({ ...nearby, isMeal: true, isDnaSuggestion: true, whyThisTime: `🍜 Lunch — ${nearby.name}` });
            lastLocation = { lat: nearby.lat, lng: nearby.lng };
          }
        }
      }
      if (dayVenues.length > 0 && dayVenues[dayVenues.length - 1].isMeal) currentTime += 100;

      // ── 4. AFTERNOON ACTIVITIES (14:00-17:00) ──
      for (let i = 0; i < 2; i++) {
        if (currentTime >= this.timeToMinutes('17:00')) break;

        if (activities.length > 0) {
          const activity = this.findNearest(activities, lastLocation || startRef);
          activities = activities.filter(v => v.id !== activity.id);
          dayVenues.push({ ...activity, whyThisTime: `🌤️ Afternoon — ${activity.name}` });
          lastLocation = { lat: activity.lat, lng: activity.lng };
        } else {
          // PRIORITY 1: DNA recommendation
          const dnaActivity = findNearestDna(dnaActivities, lastLocation || startRef);
          if (dnaActivity && !dayVenues.some(v => v.id === dnaActivity.id)) {
            dayVenues.push({ ...dnaActivity, whyThisTime: `🌤️ Afternoon — ${dnaActivity.name} (DNA Match: ${dnaActivity.whyThisTime})` });
            lastLocation = { lat: dnaActivity.lat, lng: dnaActivity.lng };
            removeFromDnaPool(dnaActivity);
          } else {
            // PRIORITY 2: Nearby search
            const nearby = await searchNearby(lastLocation!.lat, lastLocation!.lng, 'attraction');
            if (nearby && !dayVenues.some(v => v.id === nearby.id)) {
              dayVenues.push({ ...nearby, isDnaSuggestion: true, whyThisTime: `🌤️ Afternoon — ${nearby.name}` });
              lastLocation = { lat: nearby.lat, lng: nearby.lng };
            }
          }
        }
        currentTime += 160;
      }

      // ── 5. TEA BREAK (17:00-18:00) ──
      if (cafes.length > 0 && currentTime < this.timeToMinutes('18:00')) {
        const tea = cafes.shift()!;
        dayVenues.push({ ...tea, whyThisTime: `☕ Tea Break — ${tea.name}` });
        lastLocation = { lat: tea.lat, lng: tea.lng };
        currentTime += 55;
      } else if (dnaCafes.length > 0 && currentTime < this.timeToMinutes('18:00')) {
        const dnaTea = findNearestDna(dnaCafes, lastLocation || startRef);
        if (dnaTea) {
          dayVenues.push({ ...dnaTea, whyThisTime: `☕ Tea Break — ${dnaTea.name} (DNA Match: ${dnaTea.whyThisTime})` });
          lastLocation = { lat: dnaTea.lat, lng: dnaTea.lng };
          removeFromDnaPool(dnaTea);
          currentTime += 55;
        }
      }

      // ── 6. DINNER (18:30-20:00) ──
      if (restaurants.length > 0) {
        const dinner = restaurants.shift()!;
        dayVenues.push({ ...dinner, isMeal: true, whyThisTime: `🍽️ Dinner — ${dinner.name}` });
        lastLocation = { lat: dinner.lat, lng: dinner.lng };
      } else {
        // PRIORITY 1: DNA recommendation
        const dnaDinner = findNearestDna(dnaRestaurants, lastLocation || startRef);
        if (dnaDinner) {
          dayVenues.push({ ...dnaDinner, isMeal: true, whyThisTime: `🍽️ Dinner — ${dnaDinner.name} (DNA Match: ${dnaDinner.whyThisTime})` });
          lastLocation = { lat: dnaDinner.lat, lng: dnaDinner.lng };
          removeFromDnaPool(dnaDinner);
        } else {
          // PRIORITY 2: Nearby search
          const nearby = await searchNearby(lastLocation!.lat, lastLocation!.lng, 'restaurant');
          if (nearby && !dayVenues.some(v => v.id === nearby.id)) {
            dayVenues.push({ ...nearby, isMeal: true, isDnaSuggestion: true, whyThisTime: `🍽️ Dinner — ${nearby.name}` });
            lastLocation = { lat: nearby.lat, lng: nearby.lng };
          }
        }
      }
      if (dayVenues.length > 0 && dayVenues[dayVenues.length - 1].isMeal) currentTime += 100;

      // ── 7. NIGHTLIFE (20:30+) ──
      if (nightlifes.length > 0 && currentTime >= this.timeToMinutes('20:30')) {
        const nightlife = nightlifes.shift()!;
        dayVenues.push({ ...nightlife, whyThisTime: `🌙 Evening — ${nightlife.name}` });
        lastLocation = { lat: nightlife.lat, lng: nightlife.lng };
      } else if (currentTime >= this.timeToMinutes('20:30') && lastLocation) {
        // PRIORITY 1: DNA recommendation
        const dnaNight = findNearestDna(dnaNightlife, lastLocation);
        if (dnaNight) {
          dayVenues.push({ ...dnaNight, whyThisTime: `🌙 Evening — ${dnaNight.name} (DNA Match: ${dnaNight.whyThisTime})` });
          lastLocation = { lat: dnaNight.lat, lng: dnaNight.lng };
          removeFromDnaPool(dnaNight);
        } else {
          // PRIORITY 2: Nearby search
          const nearby = await searchNearby(lastLocation.lat, lastLocation.lng, 'nightlife');
          if (nearby && !dayVenues.some(v => v.id === nearby.id)) {
            dayVenues.push({ ...nearby, isDnaSuggestion: true, whyThisTime: `🌙 Evening — ${nearby.name}` });
            lastLocation = { lat: nearby.lat, lng: nearby.lng };
          }
        }
      }

      // STOP CONDITIONS (same as before)
      if (dayVenues.length === 0) break;
      const userAddedRemaining = cafes.length + restaurants.length + activities.length + nightlifes.length;
      const userAddedInThisDay = dayVenues.filter(v => v.userAdded).length;
      if (userAddedRemaining === 0 && userAddedInThisDay === 0) break;

      days.push({
        day: dayNumber++,
        theme: this.inferTheme(dayVenues),
        venues: dayVenues,
        totalDurationMinutes: dayVenues.reduce((sum, v) => sum + v.durationMinutes, 0),
        estimatedWalkingKm: this.estimateTotalDistance(dayVenues),
      });

      if (cafes.length === 0 && restaurants.length === 0 && activities.length === 0 && nightlifes.length === 0) break;
    }

    console.log(`[buildItinerary] Created ${days.length} days. DNA remaining: ${dnaCafes.length + dnaRestaurants.length + dnaActivities.length + dnaNightlife.length}`);
    return days;
  }
  // ═══════════════════════════════════════════════════════════════
  // ASSIGN TIME SLOTS WITH GOOGLE DIRECTIONS DRIVE TIMES
  // ═══════════════════════════════════════════════════════════════
  async assignTimeSlotsWithDirections(
    dayPlan: DayPlan,
    getDirections: (origin: any, dest: any, waypoints: any[]) => Promise<DirectionsResponse | null>
  ): Promise<DayPlan> {

    const venues = dayPlan.venues;
    if (venues.length < 2) {
      return this.assignBasicTimeSlots(dayPlan);
    }

    // Build route through ALL venues in scheduled order
    const origin = { lat: venues[0].lat, lng: venues[0].lng };
    const destination = { lat: venues[venues.length - 1].lat, lng: venues[venues.length - 1].lng };
    const waypoints = venues.slice(1, -1).map(v => ({ lat: v.lat, lng: v.lng }));

    // Call Google Directions API with driving mode
    let legDurations: number[] = [];
    let routeDetails: DirectionsResponse | null = null;

    try {
      routeDetails = await getDirections(origin, destination, waypoints);

      if (routeDetails && routeDetails.status === 'OK' && routeDetails.legs) {
        legDurations = routeDetails.legs.map((leg: any) => {
          // Backend returns duration as text string: "4 mins", "1 hour 30 mins"
          const durationText = leg.duration || '';
          const seconds = this.parseDurationText(durationText);
          return Math.max(1, Math.round(seconds / 60));
        });
        console.log(`Day ${dayPlan.day} Google Directions (driving):`, legDurations);
      } else {
        console.warn(`Day ${dayPlan.day} Directions API returned:`, routeDetails?.status);
      }
    } catch (err) {
      console.error(`Day ${dayPlan.day} Directions API failed:`, err);
    }

    // Fallback: if API failed, estimate from distances
    if (legDurations.length === 0 || legDurations.length !== venues.length - 1) {
      legDurations = this.estimateDriveTimes(venues);
      console.log(`Day ${dayPlan.day} using estimated drive times:`, legDurations);
    }

    // Assign time slots using the leg durations
    return this.assignTimeSlotsWithLegs(dayPlan, legDurations, routeDetails);
  }

  // ═══════════════════════════════════════════════════════════════
  // TIME SLOT ASSIGNMENT (internal)
  // ═══════════════════════════════════════════════════════════════
  private assignTimeSlotsWithLegs(
    dayPlan: DayPlan,
    legDurations: number[],
    routeDetails: DirectionsResponse | null
  ): DayPlan {
    const venues = [...dayPlan.venues];
    const timed: PlannedVenue[] = [];
    let current = this.timeToMinutes('08:00');

    for (let i = 0; i < venues.length; i++) {
      const venue = venues[i];
      const travel = i < legDurations.length ? legDurations[i] : 0;
      const end = current + venue.durationMinutes;

      timed.push({
        ...venue,
        startTime: this.minutesToTime(current),
        endTime: this.minutesToTime(end),
        travelToNext: travel,
      });

      current = end + travel;
    }

    const totalTravel = legDurations.reduce((sum, t) => sum + t, 0);

    return {
      ...dayPlan,
      venues: timed,
      startTime: timed[0]?.startTime || '08:00',
      endTime: timed[timed.length - 1]?.endTime || '22:00',
      totalTravelMinutes: totalTravel,
      totalDurationMinutes: current - this.timeToMinutes('08:00'),
      routeDetails: routeDetails || undefined,
    };
  }

  private assignBasicTimeSlots(dayPlan: DayPlan): DayPlan {
    const legDurations = this.estimateDriveTimes(dayPlan.venues);
    return this.assignTimeSlotsWithLegs(dayPlan, legDurations, null);
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private findNearest(venues: PlannedVenue[], ref: { lat: number; lng: number }): PlannedVenue {
    return [...venues].sort((a, b) => {
      const distA = this.haversine(a.lat, a.lng, ref.lat, ref.lng);
      const distB = this.haversine(b.lat, b.lng, ref.lat, ref.lng);
      return distA - distB;
    })[0];
  }

  private createPlaceholder(
    type: 'cafe' | 'restaurant' | 'attraction',
    label: string,
    ref: { lat: number; lng: number }
  ): PlannedVenue {
    const defaults: Record<string, { emoji: string; duration: number }> = {
      cafe: { emoji: '☕', duration: 45 },
      restaurant: { emoji: '🍽️', duration: 90 },
      attraction: { emoji: '✨', duration: 120 }
    };
    const config = defaults[type];

    return {
      id: `placeholder-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${config.emoji} ${label} — Tap to browse!`,
      lat: ref.lat,
      lng: ref.lng,
      type,
      durationMinutes: config.duration,
      userAdded: false,
      isMeal: type === 'restaurant' || type === 'cafe',
      isPlaceholder: true,
      whyThisTime: `💡 Add a ${type} near your route`,
    };
  }

  // Parse duration text from Google Directions: "4 mins", "1 hour 30 mins", "1 hour"
  private parseDurationText(durationText: string): number {
    if (!durationText) return 600; // fallback 10 min = 600s

    let totalSeconds = 0;
    const hourMatch = durationText.match(/(\d+)\s*hour/);
    const minMatch = durationText.match(/(\d+)\s*min/);

    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;

    return totalSeconds || 600;
  }

  // Estimate drive times (Grab-style) when API fails
  private estimateDriveTimes(venues: PlannedVenue[]): number[] {
    const legs: number[] = [];
    for (let i = 0; i < venues.length - 1; i++) {
      const distKm = this.haversine(venues[i].lat, venues[i].lng, venues[i + 1].lat, venues[i + 1].lng);

      let minutes: number;
      if (distKm < 0.5) {
        minutes = 3 + distKm * 4;
      } else if (distKm < 2) {
        minutes = 2 + distKm * 4;
      } else if (distKm < 5) {
        minutes = 2 + distKm * 3;
      } else if (distKm < 10) {
        minutes = 2 + distKm * 2.5;
      } else {
        minutes = 2 + distKm * 2;
      }

      legs.push(Math.max(2, Math.round(minutes)));
    }
    return legs;
  }

  private estimateTotalDistance(venues: PlannedVenue[]): number {
    let total = 0;
    for (let i = 1; i < venues.length; i++) {
      total += this.haversine(venues[i - 1].lat, venues[i - 1].lng, venues[i].lat, venues[i].lng);
    }
    return Math.round(total * 10) / 10;
  }

  private inferTheme(venues: PlannedVenue[]): string {
    const types = venues.map(v => v.type);
    const counts: Record<string, number> = {};
    types.forEach(t => counts[t] = (counts[t] || 0) + 1);

    if (counts['restaurant'] >= 2) return 'Food & Culture';
    if (counts['attraction'] >= 2) return 'Heritage & Sights';
    if (counts['shopping'] >= 2) return 'Shopping & Leisure';
    if (counts['nightlife']) return 'Nightlife & Dining';
    if (counts['activity']) return 'Adventure & Wellness';
    return 'City Exploration';
  }

  // Haversine distance in km
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // LEGACY METHODS (keep for compatibility)
  // ═══════════════════════════════════════════════════════════════

  convertPlannedVenues(venues: any[], fallbackCenter?: { lat: number; lng: number }): PlannedVenue[] {
    return venues.map(v => {
      const type = this.inferType(v);

      let lat = v.lat;
      let lng = v.lng;
      if ((!lat || !lng) && v.location) {
        lat = v.location.latitude;
        lng = v.location.longitude;
      }

      const fallback = fallbackCenter || { lat: 37.5665, lng: 126.9780 };

      return {
        id: v.id || v.venueName || `venue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: v.venueName || v.name || 'Unknown Venue',
        lat: lat || fallback.lat,
        lng: lng || fallback.lng,
        type,
        category: v.category,
        durationMinutes: v.durationMinutes || this.defaultDurations[type] || 120,
        priceLevel: v.priceLevel,
        rating: v.rating,
        userAdded: true,
        locked: v.locked || false,
        lockedTime: v.lockedTime || undefined,
        preferredTime: v.preferredTime || null,
        photoUrl: v.photoUrl,
      };
    });
  }

  private inferType(v: any): PlannedVenue['type'] {
    const category = (v.category || '').toLowerCase();
    const name = (v.venueName || v.name || '').toLowerCase();
    const types = v.types || [];

    const cafeKeywords = ['cafe', 'coffee', 'toast', 'pastry', 'bagel', 'brunch', 'tea', 'bingsu', 'bread', 'cake', 'kopitiam'];
    if (cafeKeywords.some(k => name.includes(k))) return 'cafe';

    if (category === 'coffee') return 'cafe';
    if (category === 'food') return 'restaurant';
    if (category === 'culture' || category === 'attractions') return 'attraction';
    if (category === 'shopping') return 'shopping';
    if (category === 'wellness') return 'activity';
    if (category === 'nightlife') return 'nightlife';

    if (types.includes('cafe') || types.includes('bakery')) return 'cafe';
    if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
    if (types.includes('museum') || types.includes('tourist_attraction')) return 'attraction';
    if (types.includes('shopping_mall') || types.includes('store')) return 'shopping';
    if (types.includes('night_club') || types.includes('bar')) return 'nightlife';
    if (types.includes('spa') || types.includes('gym')) return 'activity';

    const foodKeywords = ['restaurant', 'kitchen', 'noodle', 'hawker', 'dining', 'eats', 'bbq', 'grill', 'sushi', 'ramen', 'steak', 'chicken', 'rice', 'nasi', 'mee', 'kway', 'dim sum', 'hotpot', 'steamboat', 'bistro'];
    if (foodKeywords.some(k => name.includes(k))) return 'restaurant';

    const nightlifeKeywords = ['bar', 'club', 'pub', 'lounge', 'karaoke', 'rooftop'];
    if (nightlifeKeywords.some(k => name.includes(k))) return 'nightlife';

    return 'attraction';
  }

  // Legacy wrapper for old code that calls this
  clusterIntoDays(venues: PlannedVenue[], requestedDays: number, dnaRecommendations: any[] = []): DayPlan[] {
    // This is now a sync wrapper — the real logic is in buildItinerary (async)
    // For backward compatibility, return basic split
    if (!venues.length) return [];

    const days: DayPlan[] = [];
    const perDay = Math.ceil(venues.length / Math.max(1, requestedDays || 1));

    for (let i = 0; i < (requestedDays || 1); i++) {
      const dayVenues = venues.slice(i * perDay, (i + 1) * perDay);
      if (!dayVenues.length) break;

      days.push({
        day: i + 1,
        theme: this.inferTheme(dayVenues),
        venues: dayVenues,
        totalDurationMinutes: dayVenues.reduce((sum, v) => sum + v.durationMinutes, 0),
        estimatedWalkingKm: this.estimateTotalDistance(dayVenues),
      });
    }

    return days;
  }

  // Legacy wrapper
  assignTimeSlotsWithTravel(dayPlan: DayPlan, travelTimes: number[] = [], dnaRecommendations: any[] = []): DayPlan {
    return this.assignTimeSlotsWithLegs(dayPlan, travelTimes, null);
  }

  private getCenter(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
    if (!points || points.length === 0) return { lat: 0, lng: 0 };
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return { lat: avgLat, lng: avgLng };
  }
}