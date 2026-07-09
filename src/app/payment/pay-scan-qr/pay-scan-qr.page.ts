import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CardContextService } from '../../services/card-context.service';
import { CardsByType, CardsService, WalletCard } from '../../services/cards.service';
import { ReceiptScanResult, ReceiptsService } from '../../services/receipts.service';
import { TransactionsService } from '../../services/transactions.service';
import { imageDataFromSource } from '../../utils/receipt-image-hash';
import {
  decodeAnyQrFromImageData,
  decodeReceiptScanPayload,
  isReceiptScanPayload,
} from '../../utils/scan-image-utils';

@Component({
  selector: 'app-scan-qr',
  templateUrl: './pay-scan-qr.page.html',
  styleUrls: ['./pay-scan-qr.page.scss'],
  standalone: false,
})
export class ScanQrPage {
  selectedImage: string | null = null;
  isScanning = false;
  scanResult: ReceiptScanResult | null = null;
  scanMessage = '';
  scanError = '';
  saveSuccess = '';
  isSaving = false;

  constructor(
    private router: Router,
    private auth: AuthService,
    private receiptsService: ReceiptsService,
    private transactionsService: TransactionsService,
    private cardsService: CardsService,
    private cardContext: CardContextService
  ) {}

  closeScanner(): void {
    this.router.navigate(['/tabs/pay']);
  }

  takePhoto(): void {
    document.getElementById('camera-input')?.click();
  }

  chooseFromGallery(): void {
    document.getElementById('gallery-input')?.click();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.resetScanState();
    this.saveSuccess = '';

    const imageSeed = `${file.name}-${file.size}-${file.lastModified}`;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.selectedImage = dataUrl;
      this.processImageForScan(dataUrl, imageSeed);
    };
    reader.onerror = () => {
      this.scanError = 'Could not read the selected image. Please try again.';
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  resetScan(): void {
    this.selectedImage = null;
    this.resetScanState();
  }

  maskCardNumber(cardNumber: string | null | undefined): string {
    if (!cardNumber) {
      return '';
    }
    const digits = cardNumber.replace(/\D/g, '');
    return `**** **** **** ${digits.slice(-4)}`;
  }

  private processImageForScan(dataUrl: string, imageSeed: string): void {
    const image = new Image();
    image.onload = () => {
      const imageData = imageDataFromSource(image, image.width, image.height);
      if (!imageData) {
        this.scanError = 'Could not read the selected image. Please try again.';
        return;
      }

      const qr = decodeAnyQrFromImageData(imageData);
      if (qr && isReceiptScanPayload(qr)) {
        this.scanReceipt({ scanPayload: qr, imageSeed });
        return;
      }

      const scanPayload = decodeReceiptScanPayload(imageData);
      if (scanPayload) {
        this.scanReceipt({ scanPayload, imageSeed });
        return;
      }

      this.scanReceipt({ imageSeed });
    };
    image.onerror = () => {
      this.scanError = 'Could not read the selected image. Please try again.';
    };
    image.src = dataUrl;
  }

  private scanReceipt(payload: {
    scanPayload?: string;
    imageSeed?: string;
  }): void {
    this.isScanning = true;
    this.scanResult = null;
    this.scanMessage = '';
    this.saveSuccess = '';

    this.receiptsService.scanReceipt(payload).subscribe({
      next: (response) => {
        this.scanResult = response.receipt;
        this.scanMessage = response.message;
        this.isScanning = false;
        this.saveToTransactions(response.receipt);
      },
      error: (err: { error?: { error?: string } }) => {
        this.isScanning = false;
        this.scanError = err?.error?.error ?? 'Unable to read this receipt. Try a clearer photo.';
      },
    });
  }

  private saveToTransactions(receipt: ReceiptScanResult): void {
    const userId = this.auth.userId;
    if (!userId) {
      this.scanError = 'Please log in to save this receipt.';
      return;
    }

    this.isSaving = true;
    this.scanError = '';

    this.transactionsService.saveReceiptTransaction(userId, receipt).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.saveSuccess = response.message;
        if (response.card) {
          this.cardContext.selectCard(response.card);
        }
        this.refreshWallet();
        if (receipt.cardNumber) {
          this.saveSuccess += ` Charged to card ending ${receipt.cardNumber.slice(-4)}.`;
        }
      },
      error: (err: Error) => {
        this.isSaving = false;
        this.scanError = err.message;
      },
    });
  }

  private resetScanState(): void {
    this.scanResult = null;
    this.scanMessage = '';
    this.saveSuccess = '';
    this.scanError = '';
    this.isScanning = false;
    this.isSaving = false;
  }

  private refreshWallet(): void {
    const userId = this.auth.userId;
    if (!userId) {
      return;
    }

    const selected = this.cardContext.getSelectedCard();
    this.cardsService.getWallet(userId).subscribe({
      next: (wallet) => {
        const refreshed = this.findCardInWallet(selected, wallet);
        if (refreshed) {
          this.cardContext.selectCard(refreshed);
        }
      },
    });
  }

  private findCardInWallet(card: WalletCard | null, wallet: CardsByType): WalletCard | null {
    if (!card?.id) {
      return null;
    }

    for (const type of ['prepaid', 'cashcard', 'others'] as const) {
      const match = wallet[type].find((entry) => entry.id === card.id);
      if (match) {
        return match;
      }
    }

    return null;
  }
}
