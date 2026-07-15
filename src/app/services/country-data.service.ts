import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface CountryInfo {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  currencyCode: string;
  flag: string;
  region: string;
}

// Your 5 rich destinations with full config
export interface RichDestination {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  currencyCode: string;
  fxPair: string[];
  flag: string;
  region: string;
  categories: string[];
  packingExtras: string[];
  newsQuery: string;
}

export const RICH_DESTINATIONS: RichDestination[] = [
  {
    id: 'malaysia', name: 'Johor Bahru', country: 'Malaysia',
    lat: 1.49, lon: 103.74, currencyCode: 'MYR', fxPair: ['SGD', 'MYR'],
    flag: '🇲🇾', region: 'Asia',
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'cafe', 'night_market'],
    packingExtras: ['Mosquito repellent', 'Light cotton clothing', 'Umbrella for afternoon rain', 'Power adapter (Type G)'],
    newsQuery: 'Malaysia tourism'
  },
  {
    id: 'thailand', name: 'Bangkok', country: 'Thailand',
    lat: 13.75, lon: 100.50, currencyCode: 'THB', fxPair: ['SGD', 'THB'],
    flag: '🇹🇭', region: 'Asia',
    categories: ['restaurant', 'temple', 'shopping_mall', 'street_food', 'spa'],
    packingExtras: ['Mosquito repellent', 'Modest clothing for temples', 'Comfortable walking shoes', 'Power adapter (Type A/C)'],
    newsQuery: 'Thailand tourism'
  },
  {
    id: 'japan', name: 'Tokyo', country: 'Japan',
    lat: 35.67, lon: 139.65, currencyCode: 'JPY', fxPair: ['SGD', 'JPY'],
    flag: '🇯🇵', region: 'Asia',
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'museum', 'cafe'],
    packingExtras: ['Portable WiFi or SIM', 'Cash (many places don\'t take cards)', 'Comfortable walking shoes', 'Power adapter (Type A/B)'],
    newsQuery: 'Japan tourism'
  },
  {
    id: 'korea', name: 'Seoul', country: 'South Korea',
    lat: 37.56, lon: 126.97, currencyCode: 'KRW', fxPair: ['SGD', 'KRW'],
    flag: '🇰🇷', region: 'Asia',
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'cafe', 'kbbq'],
    packingExtras: ['T-money card for transit', 'Layered clothing', 'Korean phrasebook app', 'Power adapter (Type C/F)'],
    newsQuery: 'South Korea tourism'
  },
  {
    id: 'australia', name: 'Sydney', country: 'Australia',
    lat: -33.86, lon: 151.20, currencyCode: 'AUD', fxPair: ['SGD', 'AUD'],
    flag: '🇦🇺', region: 'Oceania',
    categories: ['restaurant', 'beach', 'tourist_attraction', 'shopping_mall', 'cafe'],
    packingExtras: ['Sunscreen (SPF 50+)', 'Swimwear', 'Hat and sunglasses', 'Power adapter (Type I)'],
    newsQuery: 'Australia tourism'
  }
];

export const GENERIC_CATEGORIES = [
  'restaurant', 'tourist_attraction', 'shopping_mall', 'cafe', 'park'
];

export const REGION_PACKING: { [key: string]: string[] } = {
  'Asia': ['Light breathable clothing', 'Mosquito repellent', 'Sunscreen', 'Comfortable sandals'],
  'Europe': ['Layered clothing', 'Umbrella', 'Comfortable walking shoes', 'Universal power adapter'],
  'Americas': ['Layered clothing', 'Sunscreen', 'Comfortable shoes', 'Reusable water bottle'],
  'Africa': ['Light cotton clothing', 'Sun hat', 'Insect repellent', 'Sturdy walking shoes'],
  'Oceania': ['Swimwear', 'Sunscreen', 'Light clothing', 'Reusable water bottle'],
};

@Injectable({ providedIn: 'root' })
export class CountryDataService {
  private apiUrl = 'http://localhost:8000/api/countries';
  private allCountries: CountryInfo[] | null = null;

  constructor(private http: HttpClient) {}

  /** Fetch all countries from backend (proxied REST Countries API) */
  getAllCountries(): Observable<CountryInfo[]> {
    if (this.allCountries) {
      console.log('[CountryData] Returning cached countries:', this.allCountries.length);
      return of(this.allCountries);
    }

    console.log('[CountryData] Fetching from:', `${this.apiUrl}/all`);
    return this.http.get(`${this.apiUrl}/all`, { responseType: 'json' }).pipe(
      tap((response: any) => {
        console.log('[CountryData] Raw API response type:', typeof response);
        console.log('[CountryData] Is Array?', Array.isArray(response));
        if (Array.isArray(response)) {
          console.log('[CountryData] Array length:', response.length);
          if (response.length > 0) {
            console.log('[CountryData] First item sample:', JSON.stringify(response[0]).substring(0, 200));
          }
        } else {
          console.log('[CountryData] Response keys:', Object.keys(response));
          console.log('[CountryData] Full response:', response);
        }
      }),
      map((response: any) => {
        const arr = this.extractArray(response);
        console.log('[CountryData] Extracted array length:', arr.length);
        this.allCountries = this.transformCountries(arr);
        console.log('[CountryData] Transformed countries:', this.allCountries.length);
        return this.allCountries;
      }),
      catchError(err => {
        console.error('[CountryData] HTTP ERROR:', err);
        console.error('[CountryData] Error status:', err.status);
        console.error('[CountryData] Error message:', err.message);
        return of([...RICH_DESTINATIONS]);
      })
    );
  }

  /** Search countries by name */
  searchCountries(query: string): Observable<CountryInfo[]> {
    if (!query || query.length < 2) return of([]);
    return this.http.get(`${this.apiUrl}/search?q=${encodeURIComponent(query)}`, { responseType: 'json' }).pipe(
      map((response: any) => {
        const arr = this.extractArray(response);
        return this.transformCountries(arr);
      }),
      catchError(() => of([]))
    );
  }

  /** Get a single country by ID */
  getCountry(id: string): Observable<CountryInfo | undefined> {
    return this.getAllCountries().pipe(
      map(countries => countries.find(c => c.id === id.toLowerCase()))
    );
  }

  /** Check if a country is one of the rich destinations */
  isRich(id: string): boolean {
    return RICH_DESTINATIONS.some(d => d.id === id.toLowerCase());
  }

  /** Get rich destination config if available */
  getRichConfig(id: string): RichDestination | undefined {
    return RICH_DESTINATIONS.find(d => d.id === id.toLowerCase());
  }

  /** Get generic destination config for any country */
  getGenericConfig(country: CountryInfo): RichDestination {
    const rich = this.getRichConfig(country.id);
    if (rich) return rich;

    return {
      id: country.id,
      name: country.name,
      country: country.country,
      lat: country.lat,
      lon: country.lon,
      currencyCode: country.currencyCode,
      fxPair: ['SGD', country.currencyCode],
      flag: country.flag,
      region: country.region,
      categories: GENERIC_CATEGORIES,
      packingExtras: REGION_PACKING[country.region] || REGION_PACKING['Asia'],
      newsQuery: `${country.country} tourism`
    };
  }

  /** Get countries by region (for progressive loading) */
  getCountriesByRegion(region: string): Observable<CountryInfo[]> {
    return this.getAllCountries().pipe(
      map(countries => countries.filter(c => c.region === region))
    );
  }

  private extractArray(response: any): any[] {
    // v5 format: response is already the objects array (backend extracts it)
    if (Array.isArray(response)) {
      console.log('[CountryData] Direct array, length:', response.length);
      return response;
    }
    // Fallback: handle wrapper formats
    if (response && typeof response === 'object') {
      if (Array.isArray(response.data)) return response.data;
      if (response.data && Array.isArray(response.data.objects)) return response.data.objects;
      const keys = Object.keys(response);
      for (const k of keys) {
        if (Array.isArray(response[k])) return response[k];
      }
    }
    console.warn('[CountryData] Could not extract array from response:', response);
    return [];
  }

  private transformCountries(apiCountries: any[]): CountryInfo[] {
    if (!Array.isArray(apiCountries)) {
      console.warn('[CountryData] transformCountries received non-array:', apiCountries);
      return [];
    }

    const map = new Map<string, CountryInfo>();

    // Add rich destinations first
    RICH_DESTINATIONS.forEach(d => {
      map.set(d.id, {
        id: d.id,
        name: d.name,
        country: d.country,
        lat: d.lat,
        lon: d.lon,
        currencyCode: d.currencyCode,
        flag: d.flag,
        region: d.region
      });
    });

    apiCountries.forEach((c: any) => {
      try {
        const code = (c.cca2 || '').toLowerCase();
        if (!code || map.has(code)) return;

        // Support both v5 format and fallback JSON format
        const name = c.names?.common || c.name?.common || c.name || 'Unknown';
        const capital = c.capitals?.[0]?.name || c.capitals?.[0] || c.capital?.[0] || name;
        // Try multiple lat/lon sources (v5 coordinates, fallback latlng, or country coordinates)
        const lat = c.capitals?.[0]?.coordinates?.lat || c.latlng?.[0] || c.latlng?.[1] || c.coordinates?.lat || 0;
        const lon = c.capitals?.[0]?.coordinates?.lng || c.latlng?.[1] || c.latlng?.[0] || c.coordinates?.lng || 0;
        // Currencies: v5 array format OR fallback object format {USD: {name: '...', symbol: '...'}}
        let currencyCode = 'USD';
        if (c.currencies) {
          if (Array.isArray(c.currencies) && c.currencies[0]?.code) {
            currencyCode = c.currencies[0].code;
          } else if (typeof c.currencies === 'object') {
            currencyCode = Object.keys(c.currencies)[0] || 'USD';
          }
        }
        // Flag: v5 emoji, fallback flag, or cca2 code
        const flag = c.flag?.emoji || c.flag || c.flags?.emoji || c.cca2 || '';
        const region = c.region || 'Asia';

        // Skip if matches a rich destination by name
        const richMatch = RICH_DESTINATIONS.find(
          r => r.country.toLowerCase() === name.toLowerCase()
        );
        if (richMatch) {
          map.set(code, {
            id: richMatch.id,
            name: richMatch.name,
            country: richMatch.country,
            lat: richMatch.lat,
            lon: richMatch.lon,
            currencyCode: richMatch.currencyCode,
            flag: richMatch.flag,
            region: richMatch.region
          });
          return;
        }

        map.set(code, {
          id: code,
          name: capital,
          country: name,
          lat: lat || 0,
          lon: lon || 0,
          currencyCode,
          flag,
          region
        });
      } catch (e) {
        console.warn('[CountryData] Failed to transform country:', c, e);
      }
    });

    const result = Array.from(map.values());
    console.log('[CountryData] Total transformed:', result.length);
    return result;
  }
}