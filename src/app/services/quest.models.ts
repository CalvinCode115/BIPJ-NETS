export interface RewardPill {
  label: string;
  style: string;
}

export interface QuestProgress {
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  meta?: { visitedCategories?: string[]; visitedMerchants?: string[] };
}

export interface QuestWithProgress {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  rewards: RewardPill[];
  requirementType: string;
  requirementTarget: number;
  requirementMeta?: { category?: string };
  progress: QuestProgress;
}

export interface DailyQuestsResponse {
  resetsIn: string;
  completedCount: number;
  totalCount: number;
  incompleteQuests: QuestWithProgress[];
  completedQuests: QuestWithProgress[];
}

export interface WeeklyQuestsResponse {
  resetsIn: string;
  inProgressQuests: QuestWithProgress[];
  claimedQuests: QuestWithProgress[];
}

export interface ChallengeWithProgress {
  id: string;
  merchantName: string;
  description?: string;
  progressUnitLabel?: string; // e.g. 'stores', 'cafes' — what the visit-count progress row should call its unit
  location?: string;
  icon: string;
  difficulty: 'easy' | 'average' | 'hard';
  durationType: 'fixed' | 'permanent' | 'monthly' | 'event';
  durationDays?: number;
  eventName?: string;
  requirementType: string;
  requirementTarget: number;
  points: number;
  rewards: RewardPill[];
  participantCount: number;
  completedCount: number;
  progress: QuestProgress | null; // null = user hasn't started it yet
  completionRatePercent: number;
  isExpired: boolean;
}

export interface PartnerChallengesResponse {
  clearedCount: number;
  totalCount: number;
  activeChallenges: ChallengeWithProgress[];
  pastChallenges: ChallengeWithProgress[];
}

export interface ClaimResponse {
  success: boolean;
  pointsAwarded: number;
}

export interface QuestEvent {
  eventType: 'transaction' | 'merchant_visit' | 'bill_split';
  amount?: number;
  merchantId?: string;
  merchantCategory?: string;
  isNewMerchant?: boolean;
}
