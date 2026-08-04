import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError } from 'rxjs';

export interface CountryInfo {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  currencyCode: string;
  region: string;
  flag: string;
}

// Featured rich destinations with full data
export const FEATURED_DESTINATIONS: CountryInfo[] = [
  { id: 'malaysia', name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lon: 101.6869, currencyCode: 'MYR', region: 'Asia', flag: '🇲🇾' },
  { id: 'thailand', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018, currencyCode: 'THB', region: 'Asia', flag: '🇹🇭' },
  { id: 'japan', name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, currencyCode: 'JPY', region: 'Asia', flag: '🇯🇵' },
  { id: 'korea', name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.9780, currencyCode: 'KRW', region: 'Asia', flag: '🇰🇷' },
  { id: 'australia', name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, currencyCode: 'AUD', region: 'Oceania', flag: '🇦🇺' },
];

@Injectable({
  providedIn: 'root'
})
export class CountryDataService {
  private apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  getAllCountries(): Observable<CountryInfo[]> {
    console.log('[CountryData] Fetching from:', `${this.apiUrl}/api/countries/all`);
    return this.http.get<any[]>(`${this.apiUrl}/api/countries/all`).pipe(
      map(data => {
        console.log('[CountryData] Raw API response type:', typeof data);
        console.log('[CountryData] Is Array?', Array.isArray(data));
        if (Array.isArray(data)) {
          console.log('[CountryData] Array length:', data.length);
          if (data.length > 0) {
            console.log('[CountryData] First item sample:', JSON.stringify(data[0]).substring(0, 200));
          }
        }
        const transformed = this.transformCountries(data);
        console.log('[CountryData] Transformed countries:', transformed.length);
        return transformed;
      }),
      catchError(err => {
        console.error('[CountryData] API error:', err);
        return of([...FEATURED_DESTINATIONS]);
      })
    );
  }

  searchCountries(query: string): Observable<CountryInfo[]> {
    if (!query || query.length < 2) return of([]);
    return this.http.get<any[]>(`${this.apiUrl}/api/countries/search?q=${encodeURIComponent(query)}`).pipe(
      map(data => this.transformCountries(data)),
      catchError(() => of([]))
    );
  }

  isRich(id: string): boolean {
    return FEATURED_DESTINATIONS.some(d => d.id === id);
  }

  getRichConfig(id: string): CountryInfo | undefined {
    return FEATURED_DESTINATIONS.find(d => d.id === id);
  }

  getRegionColor(region: string): string {
    const colors: Record<string, string> = {
      'Asia': '#ef4444',
      'Europe': '#14b8a6',
      'Americas': '#3b82f6',
      'Africa': '#eab308',
      'Oceania': '#22c55e',
      'Antarctic': '#a855f7',
    };
    return colors[region] || '#8b5cf6';
  }

  private transformCountries(data: any[]): CountryInfo[] {
    if (!Array.isArray(data)) {
      console.warn('[CountryData] Expected array, got:', typeof data);
      return [...FEATURED_DESTINATIONS];
    }

    const countries: CountryInfo[] = [];
    const seen = new Set<string>();

    for (const c of data) {
      if (!c) continue;

      // mledoze/countries.json format:
      // { name: { common: "..." }, cca2: "...", capital: ["..."], region: "...", latlng: [lat, lon], currencies: { "USD": {...} }, flag: "🇺🇸" }
      const name = c.name?.common || c.name || 'Unknown';
      const code = c.cca2 || c.alpha2Code || '';
      const capital = (c.capital && Array.isArray(c.capital) && c.capital[0]) ? c.capital[0] : name;
      const region = c.region || 'Unknown';
      const flag = c.flag || '🏳️';

      // Get lat/lng
      let lat = 20, lon = 0;
      if (c.latlng && Array.isArray(c.latlng) && c.latlng.length >= 2) {
        lat = c.latlng[0];
        lon = c.latlng[1];
      }

      // Get currency code from currencies object
      let currencyCode = 'USD';
      if (c.currencies && typeof c.currencies === 'object') {
        const keys = Object.keys(c.currencies);
        if (keys.length > 0) {
          currencyCode = keys[0];
        }
      }

      const id = code.toLowerCase() || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!id || seen.has(id)) continue;
      seen.add(id);

      countries.push({
        id,
        name: capital,
        country: name,
        lat,
        lon,
        currencyCode,
        region,
        flag
      });
    }

    // Add featured destinations if not already present
    for (const featured of FEATURED_DESTINATIONS) {
      if (!seen.has(featured.id)) {
        countries.unshift(featured);
        seen.add(featured.id);
      }
    }

    console.log('[CountryData] Total transformed:', countries.length);
    return countries;
  }
}