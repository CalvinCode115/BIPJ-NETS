export interface DestinationConfig {
  id: string;
  name: string;
  country: string;
  currencyCode: string;
  homeCurrencyCode: string;
  flag: string;
  lat: number;
  lon: number;
  fxPair: [string, string];      // [base, target] e.g., ['SGD', 'MYR']
  newsQuery: string;
  packingExtras: string[];
  categories: string[];          // Google Places types to search
  timezone: string;
}

export const DESTINATIONS: Record<string, DestinationConfig> = {
  malaysia: {
    id: 'malaysia',
    name: 'Johor Bahru',
    country: 'Malaysia',
    currencyCode: 'MYR',
    homeCurrencyCode: 'SGD',
    flag: '🇲🇾',
    lat: 1.4927,
    lon: 103.7414,
    fxPair: ['SGD', 'MYR'],
    newsQuery: 'Singapore Malaysia currency exchange ringgit',
    packingExtras: ['Mosquito repellent', 'Universal adapter (Type G)', 'Cash for hawker centers'],
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'cafe', 'spa'],
    timezone: 'Asia/Kuala_Lumpur'
  },
  thailand: {
    id: 'thailand',
    name: 'Bangkok',
    country: 'Thailand',
    currencyCode: 'THB',
    homeCurrencyCode: 'SGD',
    flag: '🇹🇭',
    lat: 13.7563,
    lon: 100.5018,
    fxPair: ['SGD', 'THB'],
    newsQuery: 'Singapore Thailand baht currency exchange',
    packingExtras: ['Temple-appropriate clothing (covered shoulders/knees)', 'Mosquito repellent', 'Cash (many places don\'t take card)'],
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'temple', 'street_food'],
    timezone: 'Asia/Bangkok'
  },
  japan: {
    id: 'japan',
    name: 'Tokyo',
    country: 'Japan',
    currencyCode: 'JPY',
    homeCurrencyCode: 'SGD',
    flag: '🇯🇵',
    lat: 35.6762,
    lon: 139.6503,
    fxPair: ['SGD', 'JPY'],
    newsQuery: 'Singapore Japan yen currency exchange',
    packingExtras: ['Portable WiFi rental or eSIM', 'Cash (Japan is cash-heavy)', 'Comfortable walking shoes'],
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'museum', 'cafe'],
    timezone: 'Asia/Tokyo'
  },
  korea: {
    id: 'korea',
    name: 'Seoul',
    country: 'South Korea',
    currencyCode: 'KRW',
    homeCurrencyCode: 'SGD',
    flag: '🇰🇷',
    lat: 37.5665,
    lon: 126.9780,
    fxPair: ['SGD', 'KRW'],
    newsQuery: 'Singapore Korea won currency exchange',
    packingExtras: ['T-money card for transit', 'Korean power adapter (Type C/F)', 'Layered clothing'],
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'cafe', 'spa'],
    timezone: 'Asia/Seoul'
  },
  australia: {
    id: 'australia',
    name: 'Sydney',
    country: 'Australia',
    currencyCode: 'AUD',
    homeCurrencyCode: 'SGD',
    flag: '🇦🇺',
    lat: -33.8688,
    lon: 151.2093,
    fxPair: ['SGD', 'AUD'],
    newsQuery: 'Singapore Australia dollar currency exchange',
    packingExtras: ['Sunscreen (strong UV)', 'Swimwear', 'Power adapter (Type I)'],
    categories: ['restaurant', 'shopping_mall', 'tourist_attraction', 'beach', 'cafe'],
    timezone: 'Australia/Sydney'
  }
};

export const DESTINATION_IDS = Object.keys(DESTINATIONS);
export const DEFAULT_DESTINATION = 'malaysia';