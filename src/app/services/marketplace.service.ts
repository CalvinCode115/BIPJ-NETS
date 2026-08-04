import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MarketplaceVouchersResponse, RedeemVoucherResponse } from './marketplace.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class MarketplaceService {

  constructor(private http: HttpClient) {}

  getVouchers(): Observable<MarketplaceVouchersResponse> {
    return this.http.get<MarketplaceVouchersResponse>(`${environment.apiUrl}/marketplace/vouchers`);
  }

  redeemVoucher(userId: string, voucherId: string): Observable<RedeemVoucherResponse> {
    return this.http.post<RedeemVoucherResponse>(
      `${environment.apiUrl}/users/${userId}/marketplace/vouchers/${voucherId}/redeem`,
      {}
    );
  }
}
