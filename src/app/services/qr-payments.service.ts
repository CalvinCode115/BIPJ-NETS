import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { TransactionRecord, TransactionsService } from './transactions.service';
import { PetBridgeService } from './pet-bridge.service';
import { TransactionResult } from '../models/pet.model';

export interface QrPaymentDetails {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  location?: string | null;
}

export interface DemoMerchantQr {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  location?: string;
  payload: string;
}

export interface QrPayResponse {
  success: boolean;
  message: string;
  payment: QrPaymentDetails;
  transaction: TransactionRecord;
  card: { id: string; balance: number };
  // NETS Points credited by the rewards backend for this payment.
  pointsAwarded?: number;
  // Present only when the request carried a voucherInstanceId.
  voucherApplied?: boolean;
  voucherDiscount?: number;
  voucherError?: string | null;
  // What the payment did to the pet. Added client-side by this service,
  // not returned by the backend.
  pet?: TransactionResult;
  petName?: string;
}

export interface ReceiveQrResponse {
  payload: string;
  name: string;
  phone: string;
  receiveLabel: string | null;
  receiveMode: string | null;
}

export interface QrParseResponse {
  success: boolean;
  kind: 'pay' | 'receive';
  payment?: QrPaymentDetails;
  receive?: {
    userId: string;
    name: string;
    phone: string;
    receiveLabel: string | null;
    receiveMode: string | null;
  };
}

@Injectable({
  providedIn: 'root',
})
export class QrPaymentsService {
  constructor(
    private http: HttpClient,
    private petBridge: PetBridgeService,
    private transactions: TransactionsService
  ) {}

  getDemoMerchants(): Observable<{ merchants: DemoMerchantQr[] }> {
    return this.http.get<{ merchants: DemoMerchantQr[] }>(`${API_BASE_URL}/pay/qr-merchants/summary`).pipe(
      catchError(() =>
        of({
          merchants: FALLBACK_DEMO_MERCHANTS,
        })
      )
    );
  }

  getReceivePayload(userId: string): Observable<ReceiveQrResponse> {
    return this.http.get<ReceiveQrResponse>(`${API_BASE_URL}/users/${userId}/qr/receive`).pipe(
      catchError(() => {
        return of({
          payload: '{"type":"nets_receive","name":"Guest","phone":""}',
          name: 'Guest',
          phone: '',
          receiveLabel: null,
          receiveMode: null,
        });
      })
    );
  }

  parsePayload(payload: string): Observable<QrParseResponse> {
    return this.http
      .post<QrParseResponse>(`${API_BASE_URL}/payments/qr/parse`, {
        payload,
      })
      .pipe(
        catchError(() => {
          try {
            return of(parsePayloadLocally(payload));
          } catch {
            return of({
              success: false,
              kind: 'pay' as const,
            });
          }
        })
      );
  }

  // `voucherInstanceId` routes a voucher-discounted payment through this same
  // method on purpose: the backend endpoint is identical, and going through
  // here is what feeds the pet. Posting to /payments/qr directly skips the
  // bridge and silently costs the user their XP.
  payWithQr(
    userId: string,
    payload: string,
    options: { cardId?: string; cardNumber?: string; voucherInstanceId?: string } = {}
  ): Observable<QrPayResponse> {
    return this.http
      .post<QrPayResponse>(`${API_BASE_URL}/users/${userId}/payments/qr`, {
        payload,
        ...options,
      })
      .pipe(
        // Payogotchi integration: a successful merchant payment feeds the pet.
        // The result is attached to the response so the payment screen can
        // report the XP earned without knowing how the pet works.
        map((res) => {
          if (!res?.success || !res.payment) {
            return res;
          }
          const pet = this.petBridge.record(
            res.payment.amount,
            res.payment.category,
            res.payment.merchant,
            res.pointsAwarded,
          );
          return { ...res, pet, petName: this.petBridge.petName };
        }),
        tap((res) => this.persistPetXp(userId, res?.transaction?.id, res?.pet))
      );
  }

  private persistPetXp(userId: string, txnId: string | undefined, pet?: TransactionResult): void {
    if (!userId || !txnId || !pet) {
      return;
    }
    this.transactions
      .recordTxnRewards(userId, txnId, {
        xpGained: pet.xpGained,
        xpCapped: pet.xpCapped,
      })
      .subscribe();
  }
}

function parsePayloadLocally(payload: string): QrParseResponse {
  const text = payload.trim();
  const json = JSON.parse(text) as {
    type?: string;
    id?: string;
    userId?: string;
    name?: string;
    phone?: string;
    merchant?: string;
    amount?: number;
    category?: string;
    location?: string;
  };

  if (json.type === 'nets_receive' && json.userId) {
    return {
      success: true,
      kind: 'receive',
      receive: {
        userId: json.userId,
        name: json.name || 'NETS User',
        phone: json.phone || '',
        receiveLabel: null,
        receiveMode: null,
      },
    };
  }

  if (!json.merchant || !json.amount) {
    throw new Error('Unsupported QR code.');
  }

  return {
    success: true,
    kind: 'pay',
    payment: {
      id: json.id || 'qr_local',
      merchant: json.merchant,
      amount: json.amount,
      category: json.category || 'Retail',
      location: json.location || null,
    },
  };
}

export const FALLBACK_DEMO_MERCHANTS: DemoMerchantQr[] = [
  {
    id: 'qr_starbucks_raffles',
    merchant: 'Starbucks Raffles Place',
    amount: 8.5,
    category: 'Coffee',
    location: 'Raffles Place, Singapore',
    payload: JSON.stringify({
      type: 'nets_pay',
      id: 'qr_starbucks_raffles',
      merchant: 'Starbucks Raffles Place',
      amount: 8.5,
      category: 'Coffee',
    }),
  },
  {
    id: 'qr_uniqlo_orchard',
    merchant: 'Uniqlo Orchard',
    amount: 26,
    category: 'Retail',
    location: 'Orchard Road, Singapore',
    payload: JSON.stringify({
      type: 'nets_pay',
      id: 'qr_uniqlo_orchard',
      merchant: 'Uniqlo Orchard',
      amount: 26,
      category: 'Retail',
    }),
  },
];

/** @deprecated use FALLBACK_DEMO_MERCHANTS */
export const FALLBACK_STARBUCKS_QR = FALLBACK_DEMO_MERCHANTS[0];
