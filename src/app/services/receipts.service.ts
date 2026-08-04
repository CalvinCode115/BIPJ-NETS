import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';

export interface ReceiptScanResult {
  id: string;
  imageUrl: string;
  merchant: string;
  amount: number;
  date: string;
  dateTime?: string;
  category: string;
  paymentMethod: string;
  cardNumber?: string | null;
}

export interface ReceiptScanResponse {
  success: boolean;
  source: 'demo_receipt' | 'ocr_simulated';
  message: string;
  receipt: ReceiptScanResult;
}

@Injectable({
  providedIn: 'root',
})
export class ReceiptsService {
  private cachedDemoReceipts: ReceiptScanResult[] = [];

  constructor(private http: HttpClient) {
    this.loadDemoReceipts().subscribe();
  }

  scanReceipt(payload: {
    receiptId?: string;
    scanPayload?: string;
    imageSeed?: string;
  }): Observable<ReceiptScanResponse> {
    return this.http.post<ReceiptScanResponse>(`${API_BASE_URL}/receipts/scan`, payload).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 400) {
          return throwError(() => err);
        }
        try {
          return of(this.resolveScanLocally(payload));
        } catch (localErr) {
          return throwError(() => localErr);
        }
      })
    );
  }

  private loadDemoReceipts(): Observable<ReceiptScanResult[]> {
    if (this.cachedDemoReceipts.length) {
      return of(this.cachedDemoReceipts);
    }

    return this.http.get<{ receipts: ReceiptScanResult[] }>(`${API_BASE_URL}/home/receipts`).pipe(
      map((response) => {
        this.cachedDemoReceipts = response.receipts ?? [];
        return this.cachedDemoReceipts;
      }),
      catchError(() => {
        this.cachedDemoReceipts = FALLBACK_RECEIPTS;
        return of(FALLBACK_RECEIPTS);
      })
    );
  }

  private resolveScanLocally(payload: {
    receiptId?: string;
    scanPayload?: string;
    imageSeed?: string;
  }): ReceiptScanResponse {
    const receipts = this.cachedDemoReceipts.length ? this.cachedDemoReceipts : FALLBACK_RECEIPTS;

    if (payload.receiptId) {
      const receipt = receipts.find((entry) => entry.id === payload.receiptId);
      if (receipt) {
        return buildScanResponse(receipt);
      }
      throw new Error('Unknown demo receipt.');
    }

    if (payload.scanPayload) {
      const fromCode = matchByScanPayload(receipts, payload.scanPayload);
      if (fromCode) {
        return buildScanResponse(fromCode);
      }
    }

    if (payload.imageSeed) {
      const seed = payload.imageSeed.toLowerCase();
      const filenameMatch = receipts.find((entry) => {
        const filename = entry.imageUrl.split('/').pop() ?? '';
        const base = filename.replace('.png', '');
        return seed.includes(entry.id.toLowerCase()) || seed.includes(filename) || seed.includes(base);
      });
      if (filenameMatch) {
        return buildScanResponse(filenameMatch);
      }
    }

    throw new Error('No matching demo receipt.');
  }
}

function buildScanResponse(receipt: ReceiptScanResult): ReceiptScanResponse {
  return {
    success: true,
    source: 'demo_receipt',
    message: 'Receipt recognised. Review details before saving.',
    receipt: { ...receipt },
  };
}

function matchByScanPayload(
  receipts: ReceiptScanResult[],
  scanPayload: string
): ReceiptScanResult | null {
  const withPayload = receipts as (ReceiptScanResult & { scanPayload?: string })[];
  const exact = withPayload.find((entry) => entry.scanPayload === scanPayload);
  if (exact) {
    return exact;
  }

  try {
    const json = JSON.parse(scanPayload);
    if (json.type === 'nets_receipt' && json.id) {
      return withPayload.find((entry) => entry.id === json.id) ?? null;
    }
  } catch {
    // barcode text
  }

  return withPayload.find((entry) => entry.scanPayload === scanPayload.trim()) ?? null;
}

export const FALLBACK_RECEIPTS: ReceiptScanResult[] = [
  {
    id: 'receipt_generic_01',
    imageUrl: 'assets/demo-receipts/receipt-generic-watsons.png',
    merchant: 'WATSONS',
    amount: 12.3,
    date: '23 Jun 2026',
    dateTime: '23 Jun 2026 14:28',
    category: 'Retail',
    paymentMethod: 'NETS Prepaid',
    cardNumber: null,
  },
  {
    id: 'receipt_generic_02',
    imageUrl: 'assets/demo-receipts/receipt-generic-fairprice.png',
    merchant: 'NTUC FAIRPRICE',
    amount: 17.6,
    date: '22 Jun 2026',
    dateTime: '22 Jun 2026 19:05',
    category: 'Groceries',
    paymentMethod: 'NETS Prepaid',
    cardNumber: null,
  },
  {
    id: 'receipt_generic_03',
    imageUrl: 'assets/demo-receipts/receipt-generic-starbucks.png',
    merchant: 'STARBUCKS',
    amount: 8.5,
    date: '28 Jun 2026',
    dateTime: '28 Jun 2026 14:34',
    category: 'Dining',
    paymentMethod: 'NETS Prepaid',
    cardNumber: null,
  },
  {
    id: 'receipt_generic_04',
    imageUrl: 'assets/demo-receipts/receipt-generic-grab.png',
    merchant: 'GRAB',
    amount: 15.0,
    date: '20 Jun 2026',
    dateTime: '20 Jun 2026 08:15',
    category: 'Transport',
    paymentMethod: 'NETS Prepaid',
    cardNumber: null,
  },
];
