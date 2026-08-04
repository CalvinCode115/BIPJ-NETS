import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DestinationConfig } from '../../services/destination.config';
import { CacheService } from '../../services/cache.service';

export interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
  humidity: number;
}

export interface DailyForecast {
  date: string;
  dayOfWeek: string;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  isRainy: boolean;
  isHot: boolean;
}

export interface ForecastResponse {
  city: string;
  forecast: DailyForecast[];
  error?: string;
}

export interface PackingItem {
  text: string;
  checked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private readonly API_BASE = 'http://localhost:8000/api';

  constructor(
    private http: HttpClient,
    private cache: CacheService
  ) {}

  /** Current weather — cached per country */
  getWeather(destination: DestinationConfig): Observable<WeatherData> {
    const cacheKey = this.cache.key('weather', destination.id);
    const cached = this.cache.get<WeatherData>(cacheKey);
    if (cached) return of(cached);

    return this.http.get<any>(
      `${this.API_BASE}/weather?lat=${destination.lat}&lon=${destination.lon}&units=metric`
    ).pipe(
      map(res => {
        if (res.error) return this.getMockWeather(destination);
        const data: WeatherData = {
          temp: res.temp,
          condition: res.condition,
          icon: this.mapWeatherIcon(res.condition),
          humidity: res.humidity
        };
        this.cache.set(cacheKey, data, destination.id);
        return data;
      }),
      catchError(() => of(this.getMockWeather(destination)))
    );
  }

  /** 5-day forecast — cached per country */
  getForecast(destination: DestinationConfig): Observable<DailyForecast[]> {
    const cacheKey = this.cache.key('forecast', destination.id);
    const cached = this.cache.get<DailyForecast[]>(cacheKey);
    if (cached) return of(cached);

    return this.http.get<ForecastResponse>(
      `${this.API_BASE}/weather/forecast?lat=${destination.lat}&lon=${destination.lon}&units=metric`
    ).pipe(
      map(res => {
        const data = res.error ? this.getMockForecast(destination) : res.forecast;
        this.cache.set(cacheKey, data, destination.id);
        return data;
      }),
      catchError(() => of(this.getMockForecast(destination)))
    );
  }

  /** Generate packing list with country-specific extras */
  getPackingList(forecast: DailyForecast[], destination: DestinationConfig): PackingItem[] {
    const items = new Set<string>([
      'Passport',
      'Phone charger',
      'Wallet',
      'Power bank',
      'Travel insurance documents'
    ]);

    // Add country-specific extras from config
    destination.packingExtras.forEach(e => items.add(e));

    const hasRain = forecast.some(d => d.isRainy);
    const hasHot = forecast.some(d => d.isHot);
    const avgHumidity = forecast.reduce((sum, d) => sum + d.humidity, 0) / forecast.length;

    if (hasRain) {
      items.add('Umbrella');
      items.add('Waterproof bag cover');
      items.add('Flip-flops / sandals');
      items.add('Light rain jacket');
    }
    if (hasHot) {
      items.add('Sunscreen (SPF 50+)');
      items.add('Sunglasses');
      items.add('Hat / cap');
      items.add('Light cotton clothes');
    }
    if (avgHumidity > 75) {
      items.add('Extra socks');
      items.add('Deodorant');
      items.add('Moisture-wicking clothes');
    }
    if (forecast.some(d => d.tempMax > 35)) {
      items.add('Portable fan');
      items.add('Electrolyte packets');
    }

    return Array.from(items).map(text => ({ text, checked: false }));
  }

  /** Categorize a place as indoor or outdoor */
  isIndoorPlace(types: string[]): boolean {
    const indoorTypes = [
      'shopping_mall', 'department_store', 'museum', 'movie_theater',
      'spa', 'cafe', 'restaurant', 'food_court', 'bowling_alley',
      'arcade', 'library', 'art_gallery', 'aquarium', 'night_club',
      'bar', 'casino', 'convenience_store', 'supermarket'
    ];
    return types?.some(t => indoorTypes.includes(t)) ?? false;
  }

  /** Weather advice for a specific day */
  getDayAdvice(day: DailyForecast): string {
    if (day.isRainy) return `⛈️ ${day.condition} expected — stick to indoor activities and bring an umbrella.`;
    if (day.isHot) return `☀️ Hot day ahead (${day.tempMax}°C) — plan outdoor activities in the morning, seek AC in the afternoon.`;
    if (day.tempMax < 18) return `🧥 Chilly day (${day.tempMax}°C) — bring a jacket for outdoor exploring.`;
    if (day.tempMax < 28) return `🌤️ Pleasant weather — perfect for walking tours and outdoor exploring.`;
    return `🌥️ Mixed conditions — good for any activity, keep a light jacket handy.`;
  }

  /** Sort places by weather suitability */
  sortPlacesByWeather(places: any[], day: DailyForecast): any[] {
    return [...places].sort((a, b) => {
      const aIndoor = this.isIndoorPlace(a.types || []);
      const bIndoor = this.isIndoorPlace(b.types || []);

      if (day.isRainy || day.isHot) {
        return (bIndoor ? 1 : 0) - (aIndoor ? 1 : 0);
      } else {
        return (aIndoor ? 1 : 0) - (bIndoor ? 1 : 0);
      }
    });
  }

  /** Distribute places across days based on weather */
  buildItinerary(places: any[], forecast: DailyForecast[]): { day: DailyForecast; activities: any[] }[] {
    const indoor = places.filter(p => this.isIndoorPlace(p.types || []));
    const outdoor = places.filter(p => !this.isIndoorPlace(p.types || []));

    const itinerary: { day: DailyForecast; activities: any[] }[] = [];

    for (const day of forecast) {
      let activities: any[] = [];

      if (day.isRainy) {
        activities = [...indoor.splice(0, 3), ...outdoor.splice(0, 1)];
      } else if (day.isHot) {
        activities = [...outdoor.splice(0, 2), ...indoor.splice(0, 2)];
      } else {
        activities = [...outdoor.splice(0, 3), ...indoor.splice(0, 1)];
      }

      itinerary.push({ day, activities });
    }

    const remaining = [...indoor, ...outdoor];
    if (remaining.length > 0 && itinerary.length > 0) {
      itinerary[itinerary.length - 1].activities.push(...remaining.slice(0, 2));
    }

    return itinerary;
  }

  private mapWeatherIcon(condition: string): string {
    const map: Record<string, string> = {
      'Clear': 'sunny',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Drizzle': 'rainy',
      'Thunderstorm': 'thunderstorm',
      'Mist': 'cloudy',
      'Fog': 'cloudy',
      'Snow': 'snow'
    };
    return map[condition] || 'partly-sunny';
  }

  private getMockWeather(destination: DestinationConfig): WeatherData {
    // Climate-aware mock data
    const isTropical = ['malaysia', 'thailand'].includes(destination.id);
    return {
      temp: isTropical ? 31 : 22,
      condition: 'Clouds',
      icon: 'cloudy',
      humidity: isTropical ? 82 : 60
    };
  }

  private getMockForecast(destination: DestinationConfig): DailyForecast[] {
    const today = new Date();
    const isTropical = ['malaysia', 'thailand'].includes(destination.id);
    const conditions = isTropical
      ? ['Clouds', 'Rain', 'Clear', 'Clouds', 'Thunderstorm']
      : ['Clear', 'Clouds', 'Rain', 'Clear', 'Clouds'];

    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const cond = conditions[i];
      const baseTemp = isTropical ? 28 : 18;

      return {
        date: d.toISOString().split('T')[0],
        dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'long' }),
        tempMin: baseTemp + i - 2,
        tempMax: baseTemp + i + 3,
        tempAvg: baseTemp + i,
        condition: cond,
        icon: this.mapWeatherIcon(cond),
        humidity: isTropical ? 75 + i * 2 : 60 + i,
        windSpeed: 3 + i,
        isRainy: ['Rain', 'Thunderstorm', 'Drizzle'].includes(cond),
        isHot: (baseTemp + i + 3) > 33,
      };
    });
  }
}