/**
 * Shared API contract for NETS app team.
 * Frontend (Ionic) and backend (Express) should stay aligned with these types.
 */

export type CardType = 'prepaid' | 'cashcard' | 'others';

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  tier: string;
  points: number;
}

export interface Card {
  id: string;
  cardType: CardType;
  label: string;
  maskedNumber: string;
  balance: number;
  topUpEnabled: boolean;
}

export interface Transaction {
  id: string;
  merchant: string;
  subtitle: string;
  amount: number;
  date: string;
  time: string;
  icon: string;
  iconColor: string;
  type: 'debit' | 'credit';
  category: string;
  cardId?: string;
}

export interface DnaProfile {
  userId: string;
  traits: string[];
  topCategories: Array<{ category: string; amount: number; share: number }>;
  topMerchants: string[];
  avgDailySpend: number;
  travelHints: {
    preferredCuisines: string[];
    budgetStyle: 'budget' | 'moderate' | 'premium';
    typicalTripSpend: number;
  };
  updatedAt: string;
}

export interface DashboardResponse {
  user: {
    id: string;
    name: string;
    fullName: string;
    phone: string;
    tier: string;
    points: number;
  };
  accountTabs: Array<{ id: CardType; label: string }>;
  cardsByType: Record<CardType, Card[]>;
  defaultCard: Card | null;
  monthlySummary: {
    month: string;
    totalIn: number;
    totalInChange: number;
    totalSpent: number;
    totalSpentChange: number;
  };
  spendingCategories: Array<{ label: string; amount: number; color: string }>;
  insight: { title: string; message: string };
  recentTransactions: Transaction[];
  rewards: { currentPoints: number; targetPoints: number };
  dnaTraits: string[];
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface LinkCardRequest {
  cardType: CardType;
  cardNumber: string;
  cardholderName?: string;
  expiryDate: string;
  cvv: string;
}

export interface LinkCardResponse {
  success: boolean;
  source: 'nets_registry' | 'nets_simulated';
  message: string;
  card: Card & {
    cardNumber: string;
    cardholderName: string;
    expiryDate: string;
  };
}

export interface WalletCardsResponse {
  cardsByType: Record<CardType, Array<Card & {
    cardNumber: string;
    cardholderName: string;
    expiryDate: string;
  }>>;
}

/** Seed accounts — see guide.md */
export const DEMO_ACCOUNTS = [
  { phone: '+65 9123 4567', pin: '123456', label: 'Alex Tan' },
  { phone: '+65 8765 4321', pin: '654321', label: 'Sarah Lim' },
] as const;

/** Use AuthService.userId after login — not a hardcoded constant */
export const DEMO_USER_ID = 'user_1';

export const API_BASE_URL = 'http://localhost:3000/api';
