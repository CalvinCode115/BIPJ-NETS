export type VoucherType = 'permanent' | 'limited' | 'event';
export type VoucherDifficulty = 'easy' | 'moderate' | 'challenging' | 'premium';
export type QuantityLimitType = 'none' | 'daily' | 'weekly' | 'total';
export type VoucherCategory = 'Retail' | 'Dining' | 'Transport' | 'Groceries' | 'Travel';

export interface MarketplaceVoucher {
  id: string;
  merchantName: string;
  description: string;
  icon: string;
  logoUrl: string | null;
  category: VoucherCategory;
  pointsCost: number;
  type: VoucherType;
  difficulty: VoucherDifficulty;
  merchantIds: string[];
  eligibleCategories?: string[];
  quantityLimitType: QuantityLimitType;
  quantityLimitAmount: number | null;
  eventStartDate?: string;
  eventEndDate?: string;
  validityDays: number;
  termsAndConditions: string[];
  usageSteps: string[];
  active: boolean;
  // computed server-side
  remaining: number | null;
  soldOut: boolean;
  eventLive: boolean;
  redeemable: boolean;
}

export interface MarketplaceVouchersResponse {
  vouchers: MarketplaceVoucher[];
}

export interface RedeemVoucherResponse {
  success: boolean;
  voucherInstanceId: string;
  pointsSpent: number;
}
