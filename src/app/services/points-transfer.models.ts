export interface PhoneLookupResult {
  found: boolean;
  name?: string;
  userId?: string;
}

export interface SendPointsResponse {
  success: boolean;
  toName: string;
  amount: number;
}
