import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { TransactionRecord } from './transactions.service';
import { PetBridgeService } from './pet-bridge.service';

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
  constructor(private http: HttpClient, private petBridge: PetBridgeService) {}

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

  payWithQr(
    userId: string,
    payload: string,
    options: { cardId?: string; cardNumber?: string } = {}
  ): Observable<QrPayResponse> {
    return this.http
      .post<QrPayResponse>(`${API_BASE_URL}/users/${userId}/payments/qr`, {
        payload,
        ...options,
      })
      .pipe(
        // Payogotchi integration: a successful merchant payment feeds the pet.
        tap((res) => {
          if (res?.success && res.payment) {
            this.petBridge.record(res.payment.amount, res.payment.category, res.payment.merchant);
          }
        })
      );
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
