import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toDataURL } from 'qrcode';
import { AuthService } from '../services/auth.service';
import { CardContextService } from '../services/card-context.service';
import {
  formatCardFundsLabel,
  formatCardPaymentLabel,
  WalletCard,
  CardsByType,
  CardsService,
} from '../services/cards.service';
import { QrPaymentDetails, QrPaymentsService } from '../services/qr-payments.service';
import { ReceiptScanResult, ReceiptsService } from '../services/receipts.service';
import { TransactionsService } from '../services/transactions.service';
import { ReceiveQrDetails, TransfersService } from '../services/transfers.service';
import { sanitizeDecimalAmountInput } from '../utils/amount-input';
import { applySanitizedIonInput } from '../utils/input-validation';
import {
  maskDisplayName,
  shortReceiveLabel,
} from '../utils/display-name';
import { imageDataFromSource } from '../utils/receipt-image-hash';
import {
  decodeAnyQrFromImageData,
  decodeReceiptScanPayload,
  isReceiptScanPayload,
} from '../utils/scan-image-utils';
import {
  captureFullVideoFrame,
  captureRegionFromVideo,
} from '../utils/video-frame-capture';
import { ToastController } from '@ionic/angular';
import { VoucherEligibilityMatch } from 'shared/my-vouchers.models';
import { MyVouchersService } from 'shared/my-vouchers.service';

type QrTab = 'scan' | 'my';

@Component({
  selector: 'app-qr-code',
  templateUrl: './home-qr-code.page.html',
  styleUrls: ['./home-qr-code.page.scss'],
  standalone: false,
})
export class QrCodePage implements OnDestroy {
  @ViewChild('videoElement') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('scanCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('cameraPreview') cameraPreviewRef?: ElementRef<HTMLElement>;
  @ViewChild('scanFrame') scanFrameRef?: ElementRef<HTMLElement>;

  activeTab: QrTab = 'scan';
  cameraActive = false;
  cameraStarting = false;
  cameraError = '';
  isProcessing = false;
  scanHint = 'Point your camera at a merchant or person QR code';

  pendingPayment: QrPaymentDetails | null = null;
  pendingReceive: ReceiveQrDetails | null = null;
  transferAmount = 0;
  transferAmountText = '';
  pendingPayload = '';
  paymentSuccess = '';
  paymentError = '';

  selectedVoucherInstanceId: string | null = null;
  selectedVoucherDiscount = 0;
  eligibleVouchers: VoucherEligibilityMatch[] = [];

  activeCard: WalletCard | null = null;

  myQrDataUrl = '';
  myQrName = '';
  myQrPhone = '';
  myQrReceiveLabel = '';
  myQrReceiveMode = '';
  showMyQrDetails = false;

  receiptResult: ReceiptScanResult | null = null;
  receiptMessage = '';
  receiptError = '';
  receiptSuccess = '';

  /** True on laptop/desktop — webcam often blows out phone screens. */
  get showScreenScanTip(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= 768 && !('ontouchstart' in window);
  }

  readonly formatCardPaymentLabel = formatCardPaymentLabel;
  readonly formatCardFundsLabel = formatCardFundsLabel;
  readonly shortReceiveLabel = shortReceiveLabel;

  get canPayWithQr(): boolean {
    return Boolean(this.activeCard && this.activeCard.cardType !== 'cashcard');
  }

  get selectedPayCardId(): string {
    return this.activeCard?.id ?? '';
  }

  get cashcardBlockedMessage(): string {
    return 'NETS CashCard is for transit and gantry. Switch to Prepaid or a linked card on Home to scan and pay.';
  }

  get payingFromLabel(): string {
    return this.activeCard ? formatCardPaymentLabel(this.activeCard) : '';
  }

  get displayedPayFromFunds(): string {
    return this.activeCard ? formatCardFundsLabel(this.activeCard) : '';
  }

  get payFromBalance(): number {
    return this.activeCard?.balance ?? 0;
  }

  get transferBalanceLeft(): number {
    return Math.round((this.payFromBalance - this.transferAmount) * 100) / 100;
  }

  get transferAmountExceedsBalance(): boolean {
    return this.transferAmount >= 0.01 && this.transferAmount > this.payFromBalance + 0.001;
  }

  get transferBalanceHint(): string {
    if (this.transferAmountExceedsBalance) {
      const over = Math.round((this.transferAmount - this.payFromBalance) * 100) / 100;
      return `Exceeds balance by $${over.toFixed(2)} (available $${this.payFromBalance.toFixed(2)})`;
    }
    if (this.transferAmount >= 0.01) {
      return `Balance left: $${Math.max(0, this.transferBalanceLeft).toFixed(2)}`;
    }
    return `Available balance: $${this.payFromBalance.toFixed(2)}`;
  }

  get maskedRecipientName(): string {
    return this.pendingReceive?.name ? maskDisplayName(this.pendingReceive.name) : '';
  }

  get displayedMyQrName(): string {
    return this.showMyQrDetails ? this.myQrName : maskDisplayName(this.myQrName);
  }

  get displayedMyQrReceiveLabel(): string {
    if (!this.myQrReceiveLabel) {
      return '';
    }
    return this.showMyQrDetails
      ? this.myQrReceiveLabel
      : shortReceiveLabel(this.myQrReceiveLabel);
  }

  toggleMyQrDetails(): void {
    this.showMyQrDetails = !this.showMyQrDetails;
  }

  private mediaStream: MediaStream | null = null;
  private scanFrameId = 0;
  private receiptScanTick = 0;
  private receiptScanInFlight = false;
  private returnRoute = '/tabs/home';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private cardContext: CardContextService,
    private cardsService: CardsService,
    private qrPayments: QrPaymentsService,
    private transfersService: TransfersService,
    private receiptsService: ReceiptsService,
    private transactionsService: TransactionsService,
    private myVouchers: MyVouchersService,
    private toastController: ToastController
  ) { }

  ionViewWillEnter(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTab = tab === 'my' ? 'my' : 'scan';
    this.returnRoute = this.router.url.includes('/tabs/pay') ? '/tabs/pay' : '/tabs/home';
    this.loadActiveCard();

    if (this.activeTab === 'my') {
      this.loadMyQr();
    }
  }

  ionViewDidEnter(): void {
    if (
      this.activeTab === 'scan' &&
      this.canPayWithQr &&
      !this.cameraActive &&
      !this.pendingPayment &&
      !this.pendingReceive &&
      !this.receiptResult
    ) {
      this.startCamera();
    }
  }

  ionViewWillLeave(): void {
    this.stopCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  closePage(): void {
    this.router.navigate([this.returnRoute]);
  }

  goToHomeForCard(): void {
    this.router.navigate(['/tabs/home']);
  }

  setTab(tab: QrTab): void {
    if (this.activeTab === tab) {
      return;
    }

    this.resetPaymentState();
    this.resetReceiptState();
    this.activeTab = tab;

    if (tab === 'scan') {
      if (this.canPayWithQr) {
        this.startCamera();
      } else {
        this.stopCamera();
      }
    } else {
      this.stopCamera();
      this.showMyQrDetails = false;
      this.loadMyQr();
    }
  }

  async startCamera(): Promise<void> {
    if (
      !this.canPayWithQr ||
      this.cameraActive ||
      this.cameraStarting ||
      this.activeTab !== 'scan'
    ) {
      return;
    }

    this.cameraError = '';
    this.stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError = 'Camera is not available in this browser. Use Choose from Gallery instead.';
      return;
    }

    this.cameraStarting = true;

    try {
      this.mediaStream = await this.requestCameraStream();
      this.applyCameraTuning(this.mediaStream);
      await this.attachStreamToVideo();
    } catch {
      this.cameraStarting = false;
      this.cameraError =
        'Could not access the camera. Allow camera permission, then tap the viewfinder to try again.';
    }
  }

  restartCamera(): void {
    this.cameraError = '';
    this.startCamera();
  }

  onCameraPreviewTap(): void {
    if (
      this.cameraActive ||
      this.cameraStarting ||
      this.isProcessing ||
      this.pendingPayment ||
      this.pendingReceive ||
      this.receiptResult ||
      !this.canPayWithQr
    ) {
      return;
    }
    this.restartCamera();
  }

  private async requestCameraStream(): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false },
      { video: true, audio: false },
    ];

    let lastError: unknown;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('Camera unavailable');
  }

  private applyCameraTuning(stream: MediaStream): void {
    const track = stream.getVideoTracks()[0];
    if (!track?.getCapabilities) {
      return;
    }

    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      exposureCompensation?: { min?: number; max?: number };
      exposureMode?: string[];
    };
    const advanced: MediaTrackConstraintSet[] = [];

    if (caps.exposureMode?.includes('continuous')) {
      advanced.push({ exposureMode: 'continuous' } as MediaTrackConstraintSet);
    }

    if (typeof caps.exposureCompensation?.min === 'number') {
      const target = Math.max(caps.exposureCompensation.min, -2);
      advanced.push({ exposureCompensation: target } as MediaTrackConstraintSet);
    }

    if (advanced.length) {
      track.applyConstraints({ advanced }).catch(() => undefined);
    }
  }

  private async attachStreamToVideo(): Promise<void> {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    const video = this.videoRef?.nativeElement;
    if (!video || !this.mediaStream) {
      this.cameraStarting = false;
      return;
    }

    video.srcObject = this.mediaStream;
    video.muted = true;
    video.playsInline = true;

    try {
      await video.play();
      this.cameraActive = true;
      this.cameraStarting = false;
      this.scanHint = this.showScreenScanTip
        ? 'Hold steady — lower phone screen brightness if the preview looks washed out'
        : 'Align QR in the frame, or hold a printed receipt steady to scan';
      this.scanLoop();
    } catch {
      this.cameraStarting = false;
      throw new Error('Unable to start camera preview');
    }
  }

  takePhoto(): void {
    if (!this.canPayWithQr) {
      this.paymentError = this.cashcardBlockedMessage;
      return;
    }

    const payload = this.captureFrameForQr();
    if (payload) {
      this.stopCamera();
      if (isReceiptScanPayload(payload)) {
        this.scanReceiptImage({ scanPayload: payload });
      } else {
        this.handleQrPayload(payload);
      }
      return;
    }

    this.tryScanReceiptFromCamera();
  }

  chooseFromGallery(): void {
    if (!this.canPayWithQr) {
      this.paymentError = this.cashcardBlockedMessage;
      return;
    }

    document.getElementById('qr-gallery-input')?.click();
  }

  onGallerySelected(event: Event): void {
    if (!this.canPayWithQr) {
      this.paymentError = this.cashcardBlockedMessage;
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const imageSeed = `${file.name}-${file.size}-${file.lastModified}`;
    const reader = new FileReader();
    reader.onload = () => {
      const imageSrc = reader.result as string;
      this.processImageForScan(imageSrc, imageSeed);
    };
    reader.onerror = () => {
      this.receiptError = 'Could not read that image. Try another photo.';
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onTransferAmountInput(event: CustomEvent): void {
    const { text, amount } = sanitizeDecimalAmountInput(String(event.detail.value ?? ''));
    this.transferAmountText = text;
    this.transferAmount = amount;
    applySanitizedIonInput(event, text);
    this.paymentError = '';
  }

  confirmPayment(): void {
    const userId = this.auth.userId;
    const cardId = this.selectedPayCardId;
    if (!userId || !this.pendingPayload || !cardId || !this.canPayWithQr) {
      if (!this.canPayWithQr) {
        this.paymentError = this.cashcardBlockedMessage;
      }
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';

    if (this.selectedVoucherInstanceId) {
      this.myVouchers.payWithVoucher(userId, this.pendingPayload, cardId, this.selectedVoucherInstanceId).subscribe({
        next: async (response) => {
          this.isProcessing = false;
          this.paymentSuccess = response.message;
          this.pendingPayment = null;
          this.pendingPayload = '';
          this.selectedVoucherInstanceId = null;
          this.selectedVoucherDiscount = 0;

          if (response.voucherApplied) {
            const toast = await this.toastController.create({
              message: `Voucher applied — you saved $${response.voucherDiscount.toFixed(2)}!`,
              duration: 2000,
              position: 'top',
              color: 'success',
            });
            await toast.present();
          } else if (response.voucherError) {
            const toast = await this.toastController.create({
              message: `Payment succeeded, but the voucher couldn't be applied: ${response.voucherError}`,
              duration: 3000,
              position: 'top',
              color: 'warning',
            });
            await toast.present();
          }

          if (this.canPayWithQr) {
            this.startCamera();
          }
        },
        error: (err: { error?: { error?: string }; message?: string }) => {
          this.isProcessing = false;
          this.paymentError = err?.error?.error ?? err?.message ?? 'Payment failed. Please try again.';
        },
      });
      return;
    }

    this.qrPayments
      .payWithQr(userId, this.pendingPayload, { cardId })
      .subscribe({
        next: (response) => {
          this.isProcessing = false;
          this.paymentSuccess = response.message;
          this.pendingPayment = null;
          this.pendingPayload = '';
          if (this.canPayWithQr) {
            this.startCamera();
          }
        },
        error: (err: { error?: { error?: string }; message?: string }) => {
          this.isProcessing = false;
          this.paymentError = err?.error?.error ?? err?.message ?? 'Payment failed. Please try again.';
        },
      });
  }

  confirmTransfer(): void {
    const userId = this.auth.userId;
    const cardId = this.selectedPayCardId;
    if (!userId || !this.pendingPayload || !cardId || !this.canPayWithQr) {
      if (!this.canPayWithQr) {
        this.paymentError = this.cashcardBlockedMessage;
      }
      return;
    }

    if (this.transferAmount < 0.01) {
      this.paymentError = 'Enter an amount of at least $0.01.';
      return;
    }

    if (this.transferAmountExceedsBalance) {
      this.paymentError = `Amount exceeds available balance ($${this.payFromBalance.toFixed(2)}).`;
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';

    this.transfersService
      .payReceiveQr(userId, {
        payload: this.pendingPayload,
        amount: this.transferAmount,
        fromCardId: cardId,
      })
      .subscribe({
        next: (response) => {
          this.isProcessing = false;
          this.paymentSuccess = response.message;
          this.pendingReceive = null;
          this.pendingPayload = '';
          this.transferAmount = 0;
          this.transferAmountText = '';
          if (this.canPayWithQr) {
            this.startCamera();
          }
        },
        error: (err: { error?: { error?: string }; message?: string }) => {
          this.isProcessing = false;
          this.paymentError = err?.error?.error ?? err?.message ?? 'Transfer failed. Please try again.';
        },
      });
  }

  cancelPayment(): void {
    this.resetPaymentState();
    if (this.canPayWithQr) {
      this.startCamera();
    }
  }

  maskCardNumber(cardNumber: string | null | undefined): string {
    if (!cardNumber) {
      return '';
    }
    const digits = cardNumber.replace(/\D/g, '');
    return `**** **** **** ${digits.slice(-4)}`;
  }

  resetReceiptScan(): void {
    this.resetReceiptState();
    if (this.canPayWithQr) {
      this.startCamera();
    }
  }

  private loadActiveCard(): void {
    const userId = this.auth.userId ?? 'user_1';
    const selected = this.cardContext.getSelectedCard();

    this.cardsService.getWallet(userId).subscribe({
      next: (wallet) => {
        const refreshed = this.findCardInWallet(selected, wallet);
        const fallback = wallet.prepaid[0] ?? wallet.cashcard[0] ?? wallet.others[0] ?? null;
        this.activeCard = refreshed ?? fallback;

        if (this.activeCard) {
          this.cardContext.selectCard(this.activeCard);
        }
      },
      error: () => {
        this.activeCard = selected;
      },
    });
  }

  private findCardInWallet(card: WalletCard | null, wallet: CardsByType): WalletCard | null {
    if (!card) {
      return null;
    }

    if (card.id) {
      for (const type of ['prepaid', 'cashcard', 'others'] as const) {
        const match = wallet[type].find((entry) => entry.id === card.id);
        if (match) {
          return match;
        }
      }
    }

    const digits = card.cardNumber.replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    for (const type of ['prepaid', 'cashcard', 'others'] as const) {
      const match = wallet[type].find((entry) => entry.cardNumber.replace(/\D/g, '') === digits);
      if (match) {
        return match;
      }
    }

    return null;
  }

  private loadMyQr(): void {
    const user = this.auth.currentUser;
    const userId = this.auth.userId;
    if (!user || !userId) {
      return;
    }

    this.myQrName = user.name;
    this.myQrPhone = user.phone;

    this.qrPayments.getReceivePayload(userId).subscribe((response) => {
      this.myQrName = response.name;
      this.myQrPhone = response.phone;
      this.myQrReceiveLabel = response.receiveLabel ?? '';
      this.myQrReceiveMode = response.receiveMode ?? '';
      toDataURL(response.payload, {
        width: 240,
        margin: 2,
        color: { dark: '#111111', light: '#ffffff' },
      }).then((url: string) => {
        this.myQrDataUrl = url;
      });
    });
  }

  private scanLoop(): void {
    if (!this.cameraActive || this.pendingPayment || this.pendingReceive || this.activeTab !== 'scan') {
      return;
    }

    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      this.scanFrameId = requestAnimationFrame(() => this.scanLoop());
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      this.scanFrameId = requestAnimationFrame(() => this.scanLoop());
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const payload = decodeAnyQrFromImageData(imageData);

    if (payload) {
      this.stopCamera();
      if (isReceiptScanPayload(payload)) {
        this.scanReceiptImage({ scanPayload: payload });
      } else {
        this.handleQrPayload(payload);
      }
      return;
    }

    this.receiptScanTick += 1;
    if (this.receiptScanTick % 20 === 0 && !this.receiptScanInFlight && !this.receiptResult) {
      this.tryLiveReceiptMatch();
    }

    this.scanFrameId = requestAnimationFrame(() => this.scanLoop());
  }

  private tryLiveReceiptMatch(): void {
    const sources = this.captureReceiptSourcesFromCamera();
    if (!sources.length) {
      return;
    }

    for (const source of sources) {
      const scanPayload = decodeReceiptScanPayload(source);
      if (scanPayload) {
        this.receiptScanInFlight = true;
        this.scanReceiptImage({ scanPayload });
        return;
      }
    }
  }

  private captureFrameForQr(): string | null {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return decodeAnyQrFromImageData(imageData);
  }

  private processImageForScan(imageSrc: string, imageSeed?: string): void {
    const image = new Image();
    image.onload = () => {
      const imageData = imageDataFromSource(image, image.width, image.height);
      if (!imageData) {
        this.receiptError = 'Could not read that image. Try another photo.';
        return;
      }

      const qr = decodeAnyQrFromImageData(imageData);
      if (qr) {
        this.stopCamera();
        if (isReceiptScanPayload(qr)) {
          this.scanReceiptImage({ scanPayload: qr, imageSeed });
        } else {
          this.handleQrPayload(qr);
        }
        return;
      }

      const scanPayload = decodeReceiptScanPayload(imageData);
      if (scanPayload) {
        this.stopCamera();
        this.scanReceiptImage({ scanPayload, imageSeed });
        return;
      }

      if (imageSeed) {
        this.stopCamera();
        this.scanReceiptImage({ imageSeed });
        return;
      }

      this.receiptError = 'No QR or receipt code detected. Try a clearer photo.';
    };
    image.onerror = () => {
      this.receiptError = 'Could not read that image. Try another photo.';
    };
    image.src = imageSrc;
  }

  private handleQrPayload(payload: string): void {
    if (!this.canPayWithQr) {
      this.paymentError = this.cashcardBlockedMessage;
      return;
    }

    this.resetPaymentState();
    this.resetReceiptState();
    this.stopCamera();

    this.qrPayments.parsePayload(payload).subscribe({
      next: (response) => {
        if (!response.success) {
          this.paymentError = 'Unsupported QR code.';
          this.startCamera();
          return;
        }

        this.pendingPayload = payload;

        if (response.kind === 'receive' && response.receive) {
          if (response.receive.userId === this.auth.userId) {
            this.paymentError = 'This is your own QR code. Share it with others to receive money.';
            this.pendingPayload = '';
            this.startCamera();
            return;
          }

          this.pendingReceive = response.receive;
          this.transferAmount = 0;
          this.transferAmountText = '';
          this.scanHint = 'Enter amount and confirm your payment card';
          return;
        }

        if (response.kind === 'pay' && response.payment?.merchant && response.payment.amount) {
          this.pendingPayment = response.payment;
          this.scanHint = 'Review payment details before confirming';
          this.checkVoucherEligibility(response.payment);
          return;
        }

        this.paymentError = 'Unsupported QR code.';
        this.pendingPayload = '';
        this.startCamera();
      },
      error: (err: { error?: { error?: string } }) => {
        this.paymentError = err?.error?.error ?? 'Unsupported QR code.';
        this.startCamera();
      },
    });
  }

  private checkVoucherEligibility(payment: QrPaymentDetails): void {
    const userId = this.auth.userId;
    if (!userId) return;

    this.myVouchers
      .checkEligibility(userId, {
        merchant: payment.merchant,
        category: (payment as any).category || 'Retail',
        amount: payment.amount,
      })
      .subscribe({
        next: (res) => {
          this.eligibleVouchers = res.matches ?? [];
        },
        error: (err) => {
          console.error('Voucher eligibility check failed (payment unaffected):', err);
          this.eligibleVouchers = [];
        },
      });
  }

  /** Tapping the already-selected voucher deselects it (single-select, toggle). */
  selectVoucher(match: VoucherEligibilityMatch): void {
    if (!match.meetsConditions) return;

    if (this.selectedVoucherInstanceId === match.voucherInstanceId) {
      this.selectedVoucherInstanceId = null;
      this.selectedVoucherDiscount = 0;
      return;
    }

    this.selectedVoucherInstanceId = match.voucherInstanceId;
    this.selectedVoucherDiscount = match.discountAmount;
  }

  /** What the template should actually show as the amount to pay. */
  get displayedPaymentAmount(): number {
    if (!this.pendingPayment) return 0;
    return this.selectedVoucherInstanceId
      ? Math.max(0, this.pendingPayment.amount - this.selectedVoucherDiscount)
      : this.pendingPayment.amount;
  }

  private captureReceiptSourcesFromCamera(): ImageData[] {
    const video = this.videoRef?.nativeElement;
    const preview = this.cameraPreviewRef?.nativeElement;
    const frame = this.scanFrameRef?.nativeElement;
    if (!video) {
      return [];
    }

    const sources: ImageData[] = [];
    if (preview && frame) {
      const framed = captureRegionFromVideo(video, preview, frame);
      const expanded = captureRegionFromVideo(video, preview, frame, 1.55);
      if (framed) {
        sources.push(framed);
      }
      if (expanded) {
        sources.push(expanded);
      }
    }

    const full = captureFullVideoFrame(video);
    if (full) {
      sources.push(full);
    }

    return sources;
  }

  private tryScanReceiptFromCamera(): void {
    const video = this.videoRef?.nativeElement;
    if (!video || video.readyState < video.HAVE_ENOUGH_DATA) {
      this.cameraError = 'Camera not ready. Try again or choose from gallery.';
      return;
    }

    const sources = this.captureReceiptSourcesFromCamera();
    if (!sources.length) {
      this.cameraError = 'Could not capture the receipt. Try gallery instead.';
      return;
    }

    for (const source of sources) {
      const scanPayload = decodeReceiptScanPayload(source);
      if (scanPayload) {
        this.stopCamera();
        this.scanReceiptImage({ scanPayload });
        return;
      }
    }

    this.cameraError = this.showScreenScanTip
      ? 'No code detected. Centre the barcode or QR at the bottom of the receipt in the frame.'
      : 'No QR or receipt code detected. Try again or choose from gallery.';
  }

  private scanReceiptImage(details: {
    scanPayload?: string;
    imageSeed?: string;
  }): void {
    this.isProcessing = true;
    this.receiptError = '';
    this.receiptSuccess = '';
    this.cameraError = '';
    this.receiptScanInFlight = false;

    this.receiptsService
      .scanReceipt({
        scanPayload: details.scanPayload,
        imageSeed: details.imageSeed,
      })
      .subscribe({
        next: (response) => {
          this.receiptResult = response.receipt;
          this.receiptMessage = response.message;
          this.isProcessing = false;
        },
        error: (err: { error?: { error?: string }; message?: string }) => {
          this.isProcessing = false;
          this.receiptError =
            err?.error?.error ??
            err?.message ??
            'No QR or receipt code detected. Try a clearer photo.';
        },
      });
  }

  confirmSaveReceipt(): void {
    if (!this.receiptResult) {
      return;
    }
    this.saveReceipt(this.receiptResult);
  }

  private saveReceipt(receipt: ReceiptScanResult): void {
    const userId = this.auth.userId;
    if (!userId) {
      this.receiptError = 'Please log in to save this receipt.';
      return;
    }

    this.isProcessing = true;
    this.transactionsService.saveReceiptTransaction(userId, receipt).subscribe({
      next: (response) => {
        this.isProcessing = false;
        this.receiptSuccess = response.message;
      },
      error: (err: Error) => {
        this.isProcessing = false;
        this.receiptError = err.message;
      },
    });
  }

  private stopCamera(): void {
    if (this.scanFrameId) {
      cancelAnimationFrame(this.scanFrameId);
      this.scanFrameId = 0;
    }

    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.cameraActive = false;
    this.cameraStarting = false;

    const video = this.videoRef?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }

  scanAnother(): void {
    this.resetPaymentState();
    if (this.canPayWithQr) {
      this.startCamera();
    }
  }

  resetPaymentState(): void {
    this.pendingPayment = null;
    this.pendingReceive = null;
    this.transferAmount = 0;
    this.transferAmountText = '';
    this.pendingPayload = '';
    this.paymentSuccess = '';
    this.paymentError = '';
    this.scanHint = 'Point your camera at a merchant or person QR code';
    this.selectedVoucherInstanceId = null;
    this.selectedVoucherDiscount = 0;
    this.eligibleVouchers = [];
  }

  private resetReceiptState(): void {
    this.receiptResult = null;
    this.receiptMessage = '';
    this.receiptError = '';
    this.receiptSuccess = '';
  }
}