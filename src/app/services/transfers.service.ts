import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { TransactionRecord, TransactionsService } from './transactions.service';
import { WalletCard } from './cards.service';
import { PetBridgeService } from './pet-bridge.service';
import { TransactionResult } from '../models/pet.model';

export interface TransferRecipient {
  id: string;
  name: string;
  phone: string;
}

export interface LookupUserResponse {
  user: TransferRecipient;
  receiveLabel: string | null;
  receiveMode: string | null;
}

export interface TransferRequest {
  toUserId?: string;
  toPhone?: string;
  amount: number;
  fromCardId: string;
  channel?: 'transfer' | 'paynow' | 'qr';
}

export interface TransferResponse {
  success: boolean;
  message: string;
  transferId: string;
  amount: number;
  toUser: TransferRecipient;
  receiveLabel: string | null;
  receiveMode?: string | null;
  fromCard: WalletCard;
  toCard?: WalletCard;
  transaction: TransactionRecord;
  pet?: TransactionResult;
  petName?: string;
}

export interface ReceiveQrDetails {
  userId: string;
  name: string;
  phone: string;
  receiveLabel: string | null;
  receiveMode: string | null;
}

export interface QrReceivePayRequest {
  payload: string;
  amount: number;
  fromCardId: string;
}

@Injectable({
  providedIn: 'root',
})
export class TransfersService {
  constructor(
    private http: HttpClient,
    private petBridge: PetBridgeService,
    private transactions: TransactionsService
  ) {}

  lookupUser(phone: string): Observable<LookupUserResponse> {
    return this.http.get<LookupUserResponse>(`${API_BASE_URL}/users/lookup`, {
      params: { phone },
    });
  }

  getPayableCards(userId: string): Observable<{ cards: WalletCard[] }> {
    return this.http.get<{ cards: WalletCard[] }>(`${API_BASE_URL}/users/${userId}/payable-cards`);
  }

  transfer(userId: string, payload: TransferRequest): Observable<TransferResponse> {
    return this.http.post<TransferResponse>(`${API_BASE_URL}/users/${userId}/transfers`, payload).pipe(
      map((res) => this.feedPet(res)),
      tap((res) => this.persistPetXp(userId, res))
    );
  }

  payReceiveQr(userId: string, payload: QrReceivePayRequest): Observable<TransferResponse> {
    return this.http
      .post<TransferResponse>(`${API_BASE_URL}/users/${userId}/payments/qr/receive`, payload)
      .pipe(
        map((res) => this.feedPet(res)),
        tap((res) => this.persistPetXp(userId, res))
      );
  }

  // Payogotchi integration: sending money is still a NETS payment, so it
  // grows the pet (generic 'other' spend — no hunger, but XP + points).
  // Returns the response with the pet outcome attached so the payment
  // screen can report the XP earned.
  private feedPet(res: TransferResponse): TransferResponse {
    if (!res?.success) {
      return res;
    }
    const merchant = res.toUser?.name ? `To ${res.toUser.name}` : 'Transfer';
    const pet = this.petBridge.record(res.amount, res.transaction?.category ?? 'other', merchant);
    return { ...res, pet, petName: this.petBridge.petName };
  }

  private persistPetXp(userId: string, res: TransferResponse): void {
    const txnId = res?.transaction?.id;
    if (!res?.success || !txnId || !res.pet) {
      return;
    }
    this.transactions
      .recordTxnRewards(userId, txnId, {
        xpGained: res.pet.xpGained,
        xpCapped: res.pet.xpCapped,
      })
      .subscribe();
  }
}
