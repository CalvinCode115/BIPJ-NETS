import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MyVouchersResponse, VoucherEligibilityResponse } from './my-vouchers.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class MyVouchersService {

  constructor(private http: HttpClient) {}

  getVouchers(userId: string): Observable<MyVouchersResponse> {
    return this.http.get<MyVouchersResponse>(`${environment.apiUrl}/users/${userId}/vouchers`);
  }

  /**
   * Called right after a QR payment's merchant/amount are known, BEFORE
   * the user confirms payment — checks if any of the user's available
   * vouchers apply to this specific merchant/category.
   */
  checkEligibility(
    userId: string,
    payload: { merchant: string; category: string; amount: number }
  ): Observable<VoucherEligibilityResponse> {
    return this.http.post<VoucherEligibilityResponse>(
      `${environment.apiUrl}/users/${userId}/vouchers/check-eligibility`,
      payload
    );
  }

  /**
   * Applies a voucher to a payment (marks it used). Kept for the My
   * Vouchers manual "Simulate Use" test button — the REAL Pay/QR flow uses
   * payWithVoucher() below instead, which also applies the discount.
   */
  markUsed(
    userId: string,
    voucherInstanceId: string,
    merchant?: string,
    location?: string
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${environment.apiUrl}/users/${userId}/vouchers/${voucherInstanceId}/mark-used`,
      { merchant, location }
    );
  }

  /**
   * Completes a QR payment WITH a voucher applied. Calls the exact same
   * `/payments/qr` endpoint your groupmate's QrPaymentsService already
   * calls, just with one extra field (`voucherInstanceId`) — this avoids
   * needing to modify qr-payments.service.ts at all. Response shape
   * matches what payWithQr() already returns, plus voucherApplied /
   * voucherDiscount / voucherError.
   */
  payWithVoucher(
    userId: string,
    payload: string,
    cardId: string,
    voucherInstanceId: string
  ): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/users/${userId}/payments/qr`, {
      payload,
      cardId,
      voucherInstanceId,
    });
  }
}
