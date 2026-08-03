export interface FxRate {
  date: string;
  rate: number;
}

export interface FxCurrentResponse {
  amount: number;
  base: string;
  date: string;
  rates: {
    MYR: number;
  };
}

export interface FxHistoricalResponse {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: {
    [date: string]: {
      MYR: number;
    };
  };
}

export interface FxInsight {
  currentRate: number;
  previousRate: number;
  changePercent: number;
  trend: 'up' | 'down' | 'flat';
  high30d: number;
  low30d: number;
  average30d: number;
   rates: FxRate[];
}

export interface NewsSentiment {
  score: number;
  articleCount: number;
  headlines: string[];
}

export interface FxPrediction {
  forecastRates: FxRate[];
  confidenceUpper: number[];
  confidenceLower: number[];
  sentiment: NewsSentiment;
  technicalSignal: 'bullish' | 'bearish' | 'neutral';
  narrative: string;
}

export interface FxInsightWithPrediction extends FxInsight {
  prediction: FxPrediction;
}