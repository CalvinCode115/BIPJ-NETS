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
  locked?: boolean;        // <-- ADD
  lockedTime?: string;     // <-- ADD
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
  // Route visualization
  routeImageUrl?: string;
  routeOptimized?: boolean;
  routeDetails?: DirectionsResponse;
  mapZoom?: number;
}

export interface TimedVenue extends PlannedVenue {
  startTime: string;
  endTime: string;
  travelToNext?: number;
  isMeal?: boolean;
  whyThisTime?: string;  // Explanation for user
}

export interface TimedDayPlan extends DayPlan {
  venues: TimedVenue[];
  startTime: string;
  endTime: string;
  totalTravelMinutes: number;
}

@Injectable({ providedIn: 'root' })
export class SmartPlannerService {

  // Default durations by venue type (minutes)
  private readonly defaultDurations: Record<string, number> = {
    cafe: 45,         // Breakfast, tea break
    restaurant: 90,   // Lunch, dinner
    attraction: 150,  // Museums, sights
    shopping: 120,    // Malls, markets
    activity: 90,     // Spas, beaches
    nightlife: 180,   // Bars, clubs
  };

clusterIntoDays(venues: PlannedVenue[], requestedDays: number, dnaRecommendations: any[] = []): DayPlan[] {
  if (!venues.length) return [];

  const validVenues = venues.filter(v => v.lat && v.lng && !isNaN(v.lat) && !isNaN(v.lng));

  const optimalDays = this.calculateOptimalDays(validVenues.length > 0 ? validVenues : venues);
  const numDays = requestedDays > 0
    ? Math.min(requestedDays, validVenues.length || 1)
    : optimalDays;

  // ═══ SPLIT BY TYPE FIRST ═══
  const restaurants = validVenues.filter(v => v.type === 'restaurant');
  const cafes = validVenues.filter(v => v.type === 'cafe');
  const activities = validVenues.filter(v => 
    v.type === 'attraction' || v.type === 'shopping' || v.type === 'activity' || v.type === 'nightlife'
  );

  console.log(`Restaurants: ${restaurants.length}, Cafes: ${cafes.length}, Activities: ${activities.length}`);

  // ═══ CALCULATE DAYS NEEDED ═══
  // Each day needs: 1 cafe, up to 2 restaurants, rest are activities
  const minDaysForMeals = Math.max(
    Math.ceil(restaurants.length / 2), // Max 2 restaurants/day
    Math.ceil(cafes.length / 1),        // Max 1 cafe/day
    1
  );
  
  const totalActivitySlots = Math.max(numDays, minDaysForMeals) * 4; // ~4 activity slots/day
  const finalDays = Math.max(numDays, minDaysForMeals, Math.ceil(activities.length / 4));
  
  console.log(`Minimum days needed for meals: ${minDaysForMeals}, Final days: ${finalDays}`);

  // ═══ DISTRIBUTE ACROSS DAYS ═══
  const dayPlans: DayPlan[] = [];
  
  for (let d = 0; d < finalDays; d++) {
    const dayVenues: PlannedVenue[] = [];
    
    // 1 cafe per day (breakfast)
    if (cafes.length > d) dayVenues.push(cafes[d]);
    
    // Up to 2 restaurants per day
    const dayRestaurants = restaurants.slice(d * 2, d * 2 + 2);
    dayVenues.push(...dayRestaurants);
    
    // Fill rest with activities (4-5 per day)
    const activityStart = d * 4;
    const dayActivities = activities.slice(activityStart, activityStart + 5);
    dayVenues.push(...dayActivities);
    
    if (dayVenues.length === 0) break;

    dayPlans.push({
      day: d + 1,
      theme: this.inferTheme(dayVenues),
      venues: this.optimizeRoute(dayVenues),
      totalDurationMinutes: 0,
      estimatedWalkingKm: this.estimateWalkingDistance(dayVenues),
    });
  }

  // Assign times to each day
  return dayPlans.map(day => this.assignTimeSlots(day, undefined, dnaRecommendations));
}

  // Merge clusters that are too small
  private mergeSparseClusters(clusters: PlannedVenue[][], minVenues: number): PlannedVenue[][] {
    const result: PlannedVenue[][] = [];
    const small: PlannedVenue[][] = [];

    for (const cluster of clusters) {
      if (cluster.length >= minVenues) {
        result.push(cluster);
      } else {
        small.push(cluster);
      }
    }

    // Distribute small clusters into nearest large ones
    for (const smallCluster of small) {
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let i = 0; i < result.length; i++) {
        const dist = this.clusterDistance(smallCluster, result[i]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        result[bestIdx].push(...smallCluster);
      } else {
        // No large cluster exists, keep as-is
        result.push(smallCluster);
      }
    }

    return result.filter(c => c.length > 0);
  }

  // Distance between cluster centroids
  private clusterDistance(a: PlannedVenue[], b: PlannedVenue[]): number {
    const centerA = {
      lat: a.reduce((s, v) => s + v.lat, 0) / a.length,
      lng: a.reduce((s, v) => s + v.lng, 0) / a.length,
    };
    const centerB = {
      lat: b.reduce((s, v) => s + v.lat, 0) / b.length,
      lng: b.reduce((s, v) => s + v.lng, 0) / b.length,
    };
    return this.haversine(centerA.lat, centerA.lng, centerB.lat, centerB.lng);
  }
  // Simple K-Means (Lloyd's algorithm) for geographic clustering
  private kMeans(venues: PlannedVenue[], k: number): PlannedVenue[][] {
    // Initialize centroids randomly
    let centroids = venues
      .sort(() => Math.random() - 0.5)
      .slice(0, k)
      .map(v => ({ lat: v.lat, lng: v.lng }));

    let assignments: number[] = [];
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      // Assign each venue to nearest centroid
      const newAssignments = venues.map(venue => {
        let minDist = Infinity;
        let closest = 0;
        centroids.forEach((centroid, i) => {
          const dist = this.haversine(venue.lat, venue.lng, centroid.lat, centroid.lng);
          if (dist < minDist) {
            minDist = dist;
            closest = i;
          }
        });
        return closest;
      });

      // Check for convergence
      if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) {
        break;
      }
      assignments = newAssignments;

      // Recalculate centroids
      centroids = centroids.map((_, i) => {
        const clusterVenues = venues.filter((_, j) => assignments[j] === i);
        if (!clusterVenues.length) return centroids[i]; // Empty cluster, keep old centroid
        return {
          lat: clusterVenues.reduce((sum, v) => sum + v.lat, 0) / clusterVenues.length,
          lng: clusterVenues.reduce((sum, v) => sum + v.lng, 0) / clusterVenues.length,
        };
      });

      iterations++;
    }

    // Build clusters from assignments
    const clusters: PlannedVenue[][] = Array.from({ length: k }, () => []);
    venues.forEach((venue, i) => {
      clusters[assignments[i]].push(venue);
    });

    // Remove empty clusters
    return clusters.filter(c => c.length > 0);
  }

  // Sort clusters so Day 1 is closest to "center" of all venues
  private sortClustersByProximity(clusters: PlannedVenue[][]): PlannedVenue[][] {
    // Find overall center
    const allVenues = clusters.flat();
    const centerLat = allVenues.reduce((s, v) => s + v.lat, 0) / allVenues.length;
    const centerLng = allVenues.reduce((s, v) => s + v.lng, 0) / allVenues.length;

    // Sort by distance from center
    return clusters.sort((a, b) => {
      const centroidA = {
        lat: a.reduce((s, v) => s + v.lat, 0) / a.length,
        lng: a.reduce((s, v) => s + v.lng, 0) / a.length,
      };
      const centroidB = {
        lat: b.reduce((s, v) => s + v.lat, 0) / b.length,
        lng: b.reduce((s, v) => s + v.lng, 0) / b.length,
      };
      const distA = this.haversine(centroidA.lat, centroidA.lng, centerLat, centerLng);
      const distB = this.haversine(centroidB.lat, centroidB.lng, centerLat, centerLng);
      return distA - distB;
    });
  }

  // Nearest-neighbor TSP (simple route optimization)
  private optimizeRoute(venues: PlannedVenue[]): PlannedVenue[] {
    if (venues.length <= 2) return venues;

    const unvisited = [...venues];
    const route: PlannedVenue[] = [];

    // Start with first venue (could be improved: start with northernmost/westernmost)
    let current = unvisited.shift()!;
    route.push(current);

    while (unvisited.length) {
      let nearestIndex = 0;
      let nearestDist = Infinity;

      unvisited.forEach((venue, i) => {
        const dist = this.haversine(current.lat, current.lng, venue.lat, venue.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIndex = i;
        }
      });

      current = unvisited.splice(nearestIndex, 1)[0];
      route.push(current);
    }

    return route;
  }

  // Infer a theme for the day based on venue types
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

  // Estimate total walking distance for a day's route (km)
  // In smart-planner.service.ts
  private estimateWalkingDistance(venues: PlannedVenue[]): number {
    let total = 0;
    for (let i = 1; i < venues.length; i++) {
      const dist = this.haversine(
        venues[i - 1].lat, venues[i - 1].lng,
        venues[i].lat, venues[i].lng
      );
      console.log('Distance from', venues[i - 1].name, 'to', venues[i].name, ':', dist.toFixed(3), 'km');
      total += dist;
    }
    return Math.round(total * 10) / 10;
  }

  // Haversine distance (km)
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

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
        id: v.id || v.venueName,
        name: v.venueName || v.name,
        lat: lat || fallback.lat,
        lng: lng || fallback.lng,
        type,
        category: v.category,
        durationMinutes: v.durationMinutes || this.defaultDurations[type] || 120,
        priceLevel: v.priceLevel,
        rating: v.rating,
        userAdded: true,
        locked: v.locked || false,        // <-- PASS THROUGH
        lockedTime: v.lockedTime || undefined,  // <-- PASS THROUGH
        preferredTime: v.preferredTime || null,
        photoUrl: v.photoUrl,
      };
    });
  }

  private inferType(v: any): PlannedVenue['type'] {
    const category = (v.category || '').toLowerCase();
    const name = (v.venueName || v.name || '').toLowerCase();
    const types = v.types || [];

    // ═══ PRIORITY 1: Check venue name for cafe keywords FIRST ═══
    const cafeKeywords = ['cafe', 'coffee', 'toast', 'pastry', 'bagel', 'brunch', 'tea', 'bingsu', 'bread', 'cake', 'kopitiam'];
    if (cafeKeywords.some(k => name.includes(k))) return 'cafe';

    // ═══ PRIORITY 2: Use category from travel.service.ts ═══
    if (category === 'coffee') return 'cafe';
    if (category === 'food') return 'restaurant';
    if (category === 'culture' || category === 'attractions') return 'attraction';
    if (category === 'shopping') return 'shopping';
    if (category === 'wellness') return 'activity';
    if (category === 'nightlife') return 'nightlife';

    // ═══ PRIORITY 3: Check Google Place types ═══
    if (types.includes('cafe') || types.includes('bakery')) return 'cafe';
    if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
    if (types.includes('museum') || types.includes('tourist_attraction')) return 'attraction';
    if (types.includes('shopping_mall') || types.includes('store')) return 'shopping';
    if (types.includes('night_club') || types.includes('bar')) return 'nightlife';
    if (types.includes('spa') || types.includes('gym')) return 'activity';

    // ═══ PRIORITY 4: Check name for other types ═══
    const foodKeywords = ['restaurant', 'kitchen', 'noodle', 'hawker', 'dining', 'eats', 'bbq', 'grill', 'sushi', 'ramen', 'steak', 'chicken', 'rice', 'nasi', 'mee', 'kway', 'dim sum', 'hotpot', 'steamboat', 'bistro'];
    if (foodKeywords.some(k => name.includes(k))) return 'restaurant';

    const nightlifeKeywords = ['bar', 'club', 'pub', 'lounge', 'karaoke', 'rooftop'];
    if (nightlifeKeywords.some(k => name.includes(k))) return 'nightlife';

    return 'attraction';
  }
  private splitByCount(venues: PlannedVenue[], numDays: number): DayPlan[] {
    const days: DayPlan[] = [];
    const sorted = [...venues].sort((a, b) => a.lng - b.lng);
    const perDay = Math.ceil(sorted.length / numDays);

    for (let i = 0; i < numDays; i++) {
      const start = i * perDay;
      const end = Math.min(start + perDay, sorted.length);
      const dayVenues = sorted.slice(start, end);
      if (dayVenues.length === 0) break;

      days.push({
        day: i + 1,
        theme: this.inferTheme(dayVenues),
        venues: this.optimizeRoute(dayVenues),
        totalDurationMinutes: dayVenues.reduce((sum, v) => sum + v.durationMinutes, 0),
        estimatedWalkingKm: this.estimateWalkingDistance(dayVenues),
      });
    }
    return days;
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

  private estimateTravelTime(from: PlannedVenue, to: PlannedVenue): number {
    const distanceKm = this.haversine(from.lat, from.lng, to.lat, to.lng);
    if (distanceKm < 0.3) return 5;
    if (distanceKm < 1) return Math.round(distanceKm * 12);
    if (distanceKm < 3) return Math.round(distanceKm * 8) + 5;
    return Math.round(distanceKm * 3) + 10;
  }

assignTimeSlots(dayPlan: DayPlan, weather?: any, dnaRecommendations: any[] = []): DayPlan {
  const venues = [...dayPlan.venues];
  
  // ═══ STRICT SEPARATION: Split meals vs activities ═══
  const mealVenues = venues.filter(v => v.type === 'cafe' || v.type === 'restaurant');
  const activityVenues = venues.filter(v => 
    v.type === 'attraction' || v.type === 'shopping' || v.type === 'activity' || v.type === 'nightlife'
  );
  
  // Track used IDs
  const usedMeals = new Set<string>();
  const usedActivities = new Set<string>();
  
  const getNextMeal = (type: 'cafe' | 'restaurant'): PlannedVenue | null => {
    const pool = mealVenues.filter(v => v.type === type && !usedMeals.has(v.id));
    if (pool.length === 0) return null;
    const chosen = pool[0];
    usedMeals.add(chosen.id);
    return chosen;
  };
  
  const getNextActivity = (): PlannedVenue | null => {
    const pool = activityVenues.filter(v => !usedActivities.has(v.id));
    if (pool.length === 0) return null;
    const chosen = pool[0];
    usedActivities.add(chosen.id);
    return chosen;
  };
  
  // ═══ PLACEHOLDERS & DNA FALLBACKS ═══
  const createMealPlaceholder = (type: 'cafe' | 'restaurant', mealName: string): PlannedVenue => {
    const ref = timed.length > 0 ? timed[timed.length - 1] : { lat: 0, lng: 0, name: '' };
    const defaults = { cafe: { emoji: '☕', duration: 45 }, restaurant: { emoji: '🍽️', duration: 90 } };
    const cfg = defaults[type];
    
    // Try DNA first
    const dna = this.findDnaFallback(type, this.timeToMinutes('08:00'), timed, dnaRecommendations);
    if (dna) {
      usedMeals.add(dna.id); // Mark DNA as used so it doesn't repeat
      return { ...dna, isDnaSuggestion: true, whyThisTime: `💡 From your DNA picks — ${dna.name}` };
    }
    
    return {
      id: `placeholder-${type}-${Date.now()}`,
      name: `${cfg.emoji} ${mealName} — Browse recommendations!`,
      lat: ref.lat,
      lng: ref.lng,
      type,
      durationMinutes: cfg.duration,
      userAdded: false,
      isMeal: true,
      isPlaceholder: true,
      whyThisTime: `No ${type} in your plan. Tap to browse nearby ${type}s!`,
    };
  };
  
  const createActivityPlaceholder = (): PlannedVenue | null => {
    const ref = timed.length > 0 ? timed[timed.length - 1] : { lat: 0, lng: 0, name: '' };
    const dna = this.findDnaFallback('attraction', this.timeToMinutes('08:00'), timed, dnaRecommendations);
    if (dna) {
      usedActivities.add(dna.id);
      return { ...dna, isDnaSuggestion: true, whyThisTime: `💡 From your DNA picks — ${dna.name}` };
    }
    return null; // Don't create generic activity placeholders, only DNA suggestions
  };

  const timed: PlannedVenue[] = [];
  let current = this.timeToMinutes('08:00');
  const dayEnd = this.timeToMinutes('22:00');
  let hasBreakfast = false;
  let hasLunch = false;
  let hasDinner = false;
  let mealCount = 0;

  // Helper: place a venue
  const placeVenue = (venue: PlannedVenue, label: string): void => {
    const end = current + venue.durationMinutes;
    const travel = 10; // Simplified travel estimate
    
    timed.push({
      ...venue,
      startTime: this.minutesToTime(current),
      endTime: this.minutesToTime(end),
      travelToNext: travel,
      whyThisTime: venue.whyThisTime || `${label} — ${venue.name}`,
    });
    current = end + travel;
  };

  // ═══ MAIN SCHEDULING LOOP ═══
  while (current < dayEnd && mealCount < 3) {
    
    // BREAKFAST: 08:00–09:30 (only cafe)
    if (!hasBreakfast && current < 570) {
      let cafe = getNextMeal('cafe');
      if (!cafe) cafe = createMealPlaceholder('cafe', 'Breakfast');
      placeVenue(cafe, '☕ Breakfast');
      hasBreakfast = true;
      mealCount++;
      continue;
    }

    // LUNCH: 11:30–14:00 (only restaurant)
    if (!hasLunch && current >= 690 && current < 840) {
      let restaurant = getNextMeal('restaurant');
      if (!restaurant) restaurant = createMealPlaceholder('restaurant', 'Lunch');
      placeVenue(restaurant, '🍜 Lunch');
      hasLunch = true;
      mealCount++;
      continue;
    }

    // DINNER: 18:00–21:00 (only restaurant)
    if (!hasDinner && current >= 1080 && current < 1260) {
      let restaurant = getNextMeal('restaurant');
      if (!restaurant) restaurant = createMealPlaceholder('restaurant', 'Dinner');
      placeVenue(restaurant, '🍽️ Dinner');
      hasDinner = true;
      mealCount++;
      continue;
    }

    // MORNING ACTIVITIES: 09:30–11:30
    if (current >= 570 && current < 690) {
      const activity = getNextActivity() || createActivityPlaceholder();
      if (activity) {
        placeVenue(activity, '🌅 Morning');
        continue;
      }
    }

    // AFTERNOON ACTIVITIES: 14:00–18:00
    if (current >= 840 && current < 1080) {
      const activity = getNextActivity() || createActivityPlaceholder();
      if (activity) {
        placeVenue(activity, '🌤️ Afternoon');
        continue;
      }
    }

    // EVENING ACTIVITIES: 21:00+
    if (current >= 1260) {
      const activity = getNextActivity() || createActivityPlaceholder();
      if (activity) {
        placeVenue(activity, '🌙 Evening');
        continue;
      }
    }

    // Fill gaps with activities
    const activity = getNextActivity() || createActivityPlaceholder();
    if (activity) {
      placeVenue(activity, '✨ Activity');
      continue;
    }

    break; // Nothing left to schedule
  }

  // Calculate totals
  const totalTravel = timed.reduce((sum, v, i) => 
    i < timed.length - 1 ? sum + (v.travelToNext || 0) : sum, 0
  );

  return {
    ...dayPlan,
    venues: timed,
    startTime: '08:00',
    endTime: this.minutesToTime(Math.min(current, dayEnd)),
    totalTravelMinutes: totalTravel,
    totalDurationMinutes: timed.reduce((s, v) => s + v.durationMinutes, 0) + totalTravel,
  };
}

private findDnaFallback(
  type: 'cafe' | 'restaurant' | 'attraction' | 'shopping' | 'activity' | 'nightlife',
  currentTime: number,
  timedSoFar: PlannedVenue[],
  dnaRecommendations: any[]
): PlannedVenue | null {
  if (!dnaRecommendations.length) return null;

  const categoryMap: Record<string, string[]> = {
    cafe: ['coffee'],
    restaurant: ['food'],
    attraction: ['attractions', 'culture'],
    shopping: ['shopping'],
    activity: ['wellness'],
    nightlife: ['nightlife'],
  };
  const targetCats = categoryMap[type] || [];

  // Get reference point (last placed venue or center)
  const ref = timedSoFar.length > 0
    ? timedSoFar[timedSoFar.length - 1]
    : { lat: 0, lng: 0 };

  // STRICT: Only match exact category
  const matches = dnaRecommendations.filter(r => {
    const cat = (r.category || '').toLowerCase();
    return targetCats.includes(cat);
  });

  if (!matches.length) return null;

  // Sort by distance to reference
  matches.sort((a, b) => {
    const distA = this.haversine(a.lat || ref.lat, a.lng || ref.lng, ref.lat, ref.lng);
    const distB = this.haversine(b.lat || ref.lat, b.lng || ref.lng, ref.lat, ref.lng);
    return distA - distB;
  });

  // For cafes, double-check name doesn't have restaurant keywords
  if (type === 'cafe') {
    const validCafe = matches.find(r => {
      const name = (r.venueName || '').toLowerCase();
      return !['restaurant', 'kitchen', 'dining', 'steak', 'grill'].some(k => name.includes(k));
    });
    if (validCafe) return this.createDnaVenue(validCafe, type, ref);
  }

  return this.createDnaVenue(matches[0], type, ref);
}

private createDnaVenue(rec: any, type: PlannedVenue['type'], ref: { lat: number; lng: number }): PlannedVenue {
  return {
    id: `dna-${rec.venueName}-${Date.now()}`,
    name: rec.venueName,
    lat: rec.lat || ref.lat,
    lng: rec.lng || ref.lng,
    type,
    durationMinutes: this.defaultDurations[type] || 90,
    userAdded: false,
    isMeal: type === 'restaurant' || type === 'cafe',
    isDnaSuggestion: true,
    photoUrl: rec.photoUrl,
    rating: rec.rating,
    whyThisTime: `💡 From your DNA picks — ${rec.whyMatch?.[0] || 'Highly rated nearby'}`,
  };
}

  // Helper to determine time slot
  private getTimeSlotLabel(current: number): string {
    if (current < 540) return 'breakfast';      // 08:00–09:00
    if (current < 690) return 'morning';       // 09:00–11:30
    if (current < 840) return 'lunch';         // 11:30–14:00
    if (current < 1020) return 'afternoon';    // 14:00–17:00
    if (current < 1110) return 'tea';           // 17:00–18:30
    if (current < 1260) return 'dinner';        // 18:30–21:00
    return 'evening';                            // 21:00+
  }

  // Normal flow (no locks) — your existing logic
  private assignTimeSlotsNormal(dayPlan: DayPlan, weather?: any): DayPlan {
    const venues = [...dayPlan.venues];
    const timed: PlannedVenue[] = [];

    let current = this.timeToMinutes('08:00');
    const dayEnd = this.timeToMinutes('21:00');
    let hadBreakfast = false;
    let hadLunch = false;
    let hadDinner = false;

    for (let i = 0; i < venues.length && current < dayEnd; i++) {
      const v = venues[i];
      const next = venues[i + 1];

      // Breakfast
      if (!hadBreakfast && current < 570 && v.type !== 'restaurant') {
        const mealEnd = current + 45;
        timed.push({
          ...v,
          id: 'breakfast-' + i,
          name: '🍳 Breakfast',
          type: 'restaurant',
          durationMinutes: 45,
          userAdded: false,
          isMeal: true,
          startTime: this.minutesToTime(current),
          endTime: this.minutesToTime(mealEnd),
          travelToNext: 10,
          whyThisTime: 'Start with energy',
        });
        current = mealEnd + 15;
        hadBreakfast = true;
        i--;
        continue;
      }

      // Lunch
      if (!hadLunch && current >= 690 && current < 840 && v.type !== 'restaurant') {
        const mealEnd = current + 75;
        timed.push({
          ...v,
          id: 'lunch-' + i,
          name: '🍜 Lunch',
          type: 'restaurant',
          durationMinutes: 75,
          userAdded: false,
          isMeal: true,
          startTime: this.minutesToTime(current),
          endTime: this.minutesToTime(mealEnd),
          travelToNext: 15,
          whyThisTime: 'Mid-day refuel',
        });
        current = mealEnd + 15;
        hadLunch = true;
        i--;
        continue;
      }

      // Actual venue
      const end = current + v.durationMinutes;
      if (end > dayEnd) break;

      const travel = next ? this.estimateTravelTime(v, next) : 0;
      // When placing a venue:
      const prevVenue = timed.length > 0 ? timed[timed.length - 1] : null;

      timed.push({
        ...v,
        startTime: this.minutesToTime(current),
        endTime: this.minutesToTime(end),
        travelToNext: travel,
        whyThisTime: this.generateWhyExplanation(v, current, timed.length, prevVenue, null),
      });

      current = end + travel;
    }

    // Dinner
    if (!hadDinner && current < dayEnd - 90) {
      const dinnerEnd = current + 90;
      timed.push({
        ...venues[venues.length - 1],
        id: 'dinner-end',
        name: '🍽️ Dinner',
        type: 'restaurant',
        durationMinutes: 90,
        userAdded: false,
        isMeal: true,
        startTime: this.minutesToTime(current),
        endTime: this.minutesToTime(dinnerEnd),
        whyThisTime: 'Wind down',
      });
    }

    const totalTravel = timed.reduce((sum, v, i) =>
      i < timed.length - 1 ? sum + (v.travelToNext || 0) : sum, 0
    );

    return {
      ...dayPlan,
      venues: timed,
      startTime: '08:00',
      endTime: this.minutesToTime(Math.min(current, dayEnd)),
      totalTravelMinutes: totalTravel,
      totalDurationMinutes: timed.reduce((s, v) => s + v.durationMinutes, 0) + totalTravel,
    };
  }
  private getWeatherWarning(venue: PlannedVenue, weather?: any): string | null {
    if (!weather || !weather.isRainy) return null;
    if (venue.type === 'attraction' && !this.isIndoorAttraction(venue)) {
      return '⚠️ Rain forecast — consider indoor alternative';
    }
    return null;
  }

  private isIndoorAttraction(venue: PlannedVenue): boolean {
    const indoorKeywords = ['museum', 'gallery', 'mall', 'indoor', 'aquarium', 'theater'];
    return indoorKeywords.some(k => venue.name.toLowerCase().includes(k));
  }

  private generateWhyExplanation(
    venue: PlannedVenue,
    currentTime: number,
    index: number,
    prevVenue: PlannedVenue | null,
    weatherWarning: string | null
  ): string {
    const reasons: string[] = [];

    // 1. ROUTING LOGIC — Explain why it's placed here
    if (prevVenue) {
      const dist = this.haversine(prevVenue.lat, prevVenue.lng, venue.lat, venue.lng);
      if (dist < 0.3) {
        reasons.push(`📍 Only ${Math.round(dist * 1000)}m from ${prevVenue.name} — easy walk`);
      } else if (dist < 1) {
        reasons.push(`📍 ${dist.toFixed(1)}km from ${prevVenue.name} — short trip`);
      } else {
        reasons.push(`📍 ${dist.toFixed(1)}km from ${prevVenue.name} — worth the journey`);
      }
    } else if (index === 0) {
      reasons.push('🎯 Starting point — closest to your hotel area');
    }

    // 2. TIME LOGIC — Why this time slot
    const hour = Math.floor(currentTime / 60);
    if (hour < 10) reasons.push('⏰ Morning slot — beat the crowds');
    else if (hour < 12) reasons.push('⏰ Late morning — good lighting for photos');
    else if (hour < 14) reasons.push('⏰ Lunch time — refuel before continuing');
    else if (hour < 17) reasons.push('⏰ Afternoon — shops and attractions fully open');
    else if (hour < 19) reasons.push('⏰ Golden hour — perfect for sightseeing');
    else reasons.push('⏰ Evening — nightlife and dinner peak');

    // 3. TYPE LOGIC — Why this type fits here
    if (venue.type === 'cafe') {
      if (hour < 10) reasons.push('☕ Breakfast spot — starts your day right');
      else if (hour >= 14 && hour < 18) reasons.push('☕ Tea break — afternoon pick-me-up');
    }
    if (venue.type === 'restaurant') {
      if (hour >= 11 && hour < 14) reasons.push('🍜 Lunch spot — midday energy');
      else if (hour >= 17) reasons.push('🍽️ Dinner — wind down your day');
    }
    if (venue.type === 'attraction') {
      if (hour < 10) reasons.push('🏛️ Early visit — fewer tourists');
      else reasons.push('🏛️ Prime visiting hours');
    }
    if (venue.type === 'nightlife') {
      reasons.push('🌙 Night scene — best after dark');
    }

    // 4. WEATHER
    if (weatherWarning) reasons.push(weatherWarning);

    // 5. RATING
    if (venue.rating && venue.rating >= 4.5) reasons.push('⭐ Highly rated — don\'t miss it');

    // 6. LOCKED
    if (venue.locked) reasons.push('🔒 You chose this time');

    return reasons.join(' · ');
  }

  private suggestNearbyVenue(
    type: 'cafe' | 'restaurant' | 'nightlife',
    nearLat: number,
    nearLng: number,
    excludeNames: string[]
  ): PlannedVenue {
    // In a real app, this would call your Places API
    // For now, return a placeholder that prompts the user
    const suggestions: Record<string, { name: string; emoji: string }> = {
      cafe: { name: 'Nearby Cafe', emoji: '☕' },
      restaurant: { name: 'Nearby Restaurant', emoji: '🍽️' },
      nightlife: { name: 'Nearby Bar', emoji: '🍸' },
    };

    const sug = suggestions[type];

    return {
      id: `suggested-${type}-${Date.now()}`,
      name: `${sug.emoji} ${sug.name} — Tap to find one!`,
      lat: nearLat + (Math.random() - 0.5) * 0.01,
      lng: nearLng + (Math.random() - 0.5) * 0.01,
      type,
      durationMinutes: type === 'cafe' ? 45 : type === 'restaurant' ? 90 : 180,
      userAdded: false,
      isMeal: true,
      whyThisTime: `We couldn't find a ${type} in your plan. Add one from recommendations!`,
    };
  }

  calculateOptimalDays(venues: PlannedVenue[], maxHoursPerDay: number = 13): number {
    // Total venue time
    const totalVenueMinutes = venues.reduce((sum, v) => sum + (v.durationMinutes || 90), 0);

    // Estimate travel time (rough: ~15 min between each venue)
    const estimatedTravel = (venues.length - 1) * 15;

    // Meals: assume breakfast + lunch + dinner = 45 + 75 + 90 = 210 min
    const mealMinutes = 210;

    const totalMinutes = totalVenueMinutes + estimatedTravel + mealMinutes;
    const daysNeeded = Math.ceil(totalMinutes / (maxHoursPerDay * 60));

    return Math.max(1, Math.min(daysNeeded, 7)); // Cap at 7 days
  }

  private createMealPlaceholder(
    type: 'cafe' | 'restaurant',
    mealName: string,
    currentTime: number,
    timedSoFar: PlannedVenue[]
  ): PlannedVenue {
    const ref = timedSoFar.length > 0
      ? timedSoFar[timedSoFar.length - 1]
      : { lat: 0, lng: 0 };

    const defaults: Record<string, { emoji: string; duration: number }> = {
      cafe: { emoji: '☕', duration: 45 },
      restaurant: { emoji: '🍽️', duration: 90 }
    };

    const config = defaults[type];

    return {
      id: `placeholder-${type}-${Date.now()}`,
      name: `${config.emoji} ${mealName} — Add from recommendations!`,
      lat: ref.lat,
      lng: ref.lng,
      type,
      durationMinutes: config.duration,
      userAdded: false,
      isMeal: true,
      isPlaceholder: true,
      whyThisTime: `No ${type} in your plan. Browse recommendations to add one!`,
    };
  }
}