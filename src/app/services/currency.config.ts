export interface CurrencyConfig {
    code: string;
    country: string;
    flag: string;
    fallbackRate: number;
  }
  
  export const AVAILABLE_CURRENCIES: CurrencyConfig[] = [
    { code: 'SGD', country: 'Singapore', flag: '🇸🇬', fallbackRate: 1 },
    { code: 'USD', country: 'United States', flag: '🇺🇸', fallbackRate: 0.74 },
    { code: 'EUR', country: 'Eurozone', flag: '🇪🇺', fallbackRate: 0.68 },
    { code: 'GBP', country: 'United Kingdom', flag: '🇬🇧', fallbackRate: 0.58 },
    { code: 'JPY', country: 'Japan', flag: '🇯🇵', fallbackRate: 112.5 },
    { code: 'AUD', country: 'Australia', flag: '🇦🇺', fallbackRate: 1.12 },
    { code: 'CAD', country: 'Canada', flag: '🇨🇦', fallbackRate: 1.01 },
    { code: 'CHF', country: 'Switzerland', flag: '🇨🇭', fallbackRate: 0.66 },
    { code: 'CNY', country: 'China', flag: '🇨🇳', fallbackRate: 5.35 },
    { code: 'HKD', country: 'Hong Kong', flag: '🇭🇰', fallbackRate: 5.78 },
    { code: 'KRW', country: 'South Korea', flag: '🇰🇷', fallbackRate: 985 },
    { code: 'THB', country: 'Thailand', flag: '🇹🇭', fallbackRate: 25.4 },
    { code: 'MYR', country: 'Malaysia', flag: '🇲🇾', fallbackRate: 3.15 },
    { code: 'INR', country: 'India', flag: '🇮🇳', fallbackRate: 61.5 },
    { code: 'IDR', country: 'Indonesia', flag: '🇮🇩', fallbackRate: 11500 },
    { code: 'PHP', country: 'Philippines', flag: '🇵🇭', fallbackRate: 42.5 },
    { code: 'VND', country: 'Vietnam', flag: '🇻🇳', fallbackRate: 18500 },
    { code: 'NZD', country: 'New Zealand', flag: '🇳🇿', fallbackRate: 1.22 },
  ];