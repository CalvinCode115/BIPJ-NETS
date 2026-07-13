export type VoucherStatus = 'available' | 'used' | 'expired';

export interface UserVoucher {
  id: string;
  voucherId: string;
  merchantName: string;
  description: string;
  icon: string;
  pointsCost: number;
  redeemedAt: string;
  expiresAt: string;
  status: VoucherStatus;
  usedAt: string | null;
  usedMerchant: string | null;
  usedLocation: string | null;
  termsAndConditions: string[];
  usageSteps: string[];
}

export interface VoucherEligibilityMatch {
  voucherInstanceId: string;
  merchantName: string;
  description: string;
  icon: string;
  termsAndConditions: string[];
  minSpend: number | null;
  meetsConditions: boolean;
  discountAmount: number;
  finalAmount: number | null;
  message: string | null;
}

export interface VoucherEligibilityResponse {
  matches: VoucherEligibilityMatch[];
}

export interface MyVouchersResponse {
  available: UserVoucher[];
  used: UserVoucher[];
  expired: UserVoucher[];
}
