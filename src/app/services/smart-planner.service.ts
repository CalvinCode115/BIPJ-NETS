import { Injectable } from '@angular/core';

export interface PlannedVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'restaurant' | 'attraction' | 'shopping' | 'activity' | 'nightlife';
  durationMinutes: number;        // user-set or default
  priceLevel?: number;            // 1-4 ($ to $$$$)
  rating?: number;
  userAdded: boolean;             // true = user planned, false = AI suggested
  locked?: boolean;               // user locked this item
  preferredTime?: 'morning' | 'afternoon' | 'evening' | null;
  photoUrl?: string;
}

export interface DayPlan {
  day: number;
  theme: string;
  venues: PlannedVenue[];
  totalDurationMinutes: number;
  estimatedWalkingKm: number;
}

@Injectable({ providedIn: 'root' })
export class SmartPlannerService {

  // Default durations by venue type (minutes)
  private readonly defaultDurations: Record<string, number> = {
    restaurant: 90,       // 1.5h for meals
    attraction: 120,      // 2h for museums, landmarks
    shopping: 150,        // 2.5h for malls, markets
    activity: 120,        // 2h for spas, beaches
    nightlife: 180,       // 3h for bars, clubs
  };

  // Cluster venues into days using simple distance-based grouping
clusterIntoDays(venues: PlannedVenue[], numDays: number): DayPlan[] {
  if (!venues.length) return [];
  
  const validVenues = venues.filter(v => 
    v.lat && v.lng && !isNaN(v.lat) && !isNaN(v.lng)
  );
  
  if (validVenues.length === 0) {
    return this.splitByCount(venues, numDays);
  }
  
  const actualDays = Math.min(numDays, validVenues.length);
  
  if (validVenues.length <= actualDays) {
    return validVenues.map((v, i) => ({
      day: i + 1,
      theme: this.inferTheme([v]),
      venues: [v],
      totalDurationMinutes: v.durationMinutes,
      estimatedWalkingKm: 0,
    }));
  }

  let clusters = this.kMeans(validVenues, actualDays);
  clusters = clusters.filter(c => c.length > 0);
  
  if (clusters.length < actualDays) {
    return this.splitByCount(validVenues, actualDays);
  }
  
  const avgSize = validVenues.length / actualDays;
  const isImbalanced = clusters.some(c => c.length > avgSize * 2);
  
  if (isImbalanced) {
    return this.splitByCount(validVenues, actualDays);
  }

  const sortedClusters = this.sortClustersByProximity(clusters);

  return sortedClusters.map((clusterVenues, index) => ({
    day: index + 1,
    theme: this.inferTheme(clusterVenues),
    venues: this.optimizeRoute(clusterVenues),
    totalDurationMinutes: clusterVenues.reduce((sum, v) => sum + v.durationMinutes, 0),
    estimatedWalkingKm: this.estimateWalkingDistance(clusterVenues),
  }));
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
  private estimateWalkingDistance(venues: PlannedVenue[]): number {
    let total = 0;
    for (let i = 1; i < venues.length; i++) {
      total += this.haversine(
        venues[i-1].lat, venues[i-1].lng,
        venues[i].lat, venues[i].lng
      );
    }
    return Math.round(total * 10) / 10; // Round to 1 decimal
  }

  // Haversine distance (km)
  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

convertPlannedVenues(venues: any[]): PlannedVenue[] {
  return venues.map(v => ({
    id: v.id || v.venueName,
    name: v.venueName || v.name,
    lat: (v as any).lat || (v as any).location?.latitude || 1.35,
    lng: (v as any).lng || (v as any).location?.longitude || 103.8,
    type: this.inferType(v),
    durationMinutes: (v as any).durationMinutes || this.defaultDurations[this.inferType(v)] || 120,
    priceLevel: v.priceLevel,
    rating: v.rating,
    userAdded: true,
    locked: (v as any).locked || false,
    preferredTime: (v as any).preferredTime || null,
    photoUrl: v.photoUrl,
  }));
}

  private inferType(v: any): PlannedVenue['type'] {
    const types = v.types || [];
    if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
    if (types.includes('museum') || types.includes('tourist_attraction')) return 'attraction';
    if (types.includes('shopping_mall') || types.includes('store')) return 'shopping';
    if (v.venueName?.toLowerCase().includes('spa')) return 'activity';
    if (v.venueName?.toLowerCase().includes('bar') || v.venueName?.toLowerCase().includes('club')) return 'nightlife';
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
}