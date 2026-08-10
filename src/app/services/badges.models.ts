export type BadgeSourceType = 'daily' | 'weekly' | 'challenge';

export interface Badge {
  label: string;
  sourceType: BadgeSourceType;
  sourceLabel: string; // the quest/challenge title that grants this badge
  earned: boolean;
  earnedAt: string | null;
}

export interface BadgesResponse {
  badges: Badge[];
  earnedCount: number;
  totalCount: number;
}
