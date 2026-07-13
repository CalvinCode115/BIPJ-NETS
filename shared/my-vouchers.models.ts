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

export interface MyVouchersResponse {
  available: UserVoucher[];
  used: UserVoucher[];
  expired: UserVoucher[];
}
