export interface PointsBalance {
  totalPoints: number;
  earnedThisWeek: number;
  spentThisWeek: number;
}

export interface PointsHistoryEntry {
  id: string;
  title: string;
  amount: number;
  type: string; // 'quest' | 'challenge' | 'redemption' | 'transfer' | 'bonus' | 'achievement' | 'transaction' | 'cosmetic'
  tag: string; // display label, e.g. 'Quest', 'Redemption'
  icon: string;
  timestamp: string; // ISO string
}

export interface PointsHistoryQuery {
  search?: string;
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
  limit?: number;
}

export interface PointsHistoryResponse {
  entries: PointsHistoryEntry[];
}
