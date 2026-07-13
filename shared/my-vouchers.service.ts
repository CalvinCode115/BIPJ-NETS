import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MyVouchersResponse } from './my-vouchers.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class MyVouchersService {

  constructor(private http: HttpClient) {}

  getVouchers(userId: string): Observable<MyVouchersResponse> {
    return this.http.get<MyVouchersResponse>(`${environment.apiUrl}/users/${userId}/vouchers`);
  }

  /**
   * ⚠️ TEST/DEV ONLY — simulates the future Pay/QR auto-apply hook so you
   * can test the Used tab before that integration exists. Remove or hide
   * this call once the real hook is built.
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
}
