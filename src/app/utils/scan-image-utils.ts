import jsQR from 'jsqr';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

export function normalizeForScan(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const luminance: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    luminance.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  luminance.sort((a, b) => a - b);
  const low = luminance[Math.floor(luminance.length * 0.08)] ?? 0;
  const high = luminance[Math.floor(luminance.length * 0.92)] ?? 255;
  const range = Math.max(high - low, 24);

  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const stretched = Math.min(255, Math.max(0, ((l - low) / range) * 255));
    out[i] = stretched;
    out[i + 1] = stretched;
    out[i + 2] = stretched;
    out[i + 3] = 255;
  }

  return new ImageData(out, width, height);
}

function scanVariants(imageData: ImageData): ImageData[] {
  const normalized = normalizeForScan(imageData);
  return [imageData, normalized];
}

export function decodeQrFromImageData(imageData: ImageData): string | null {
  for (const attempt of scanVariants(imageData)) {
    const code = jsQR(attempt.data, attempt.width, attempt.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code?.data) {
      return code.data;
    }
  }

  return null;
}

export function decodeBarcodeFromImageData(imageData: ImageData): string | null {
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  for (const attempt of scanVariants(imageData)) {
    try {
      const source = new RGBLuminanceSource(attempt.data, attempt.width, attempt.height);
      const result = reader.decode(new BinaryBitmap(new HybridBinarizer(source)));
      const text = result.getText()?.trim();
      if (text) {
        return text;
      }
    } catch {
      // try next variant
    }
  }

  return null;
}

export function isReceiptScanPayload(payload: string): boolean {
  if (payload.startsWith('NETS-RCP-')) {
    return true;
  }

  try {
    const json = JSON.parse(payload);
    return json?.type === 'nets_receipt' && Boolean(json.id);
  } catch {
    return false;
  }
}

export function isMerchantPayPayload(payload: string): boolean {
  try {
    const json = JSON.parse(payload);
    return json?.type === 'nets_pay' || Boolean(json?.merchant && json?.amount);
  } catch {
    return false;
  }
}

/** Decode receipt barcode or QR from a camera/gallery frame. */
export function decodeReceiptScanPayload(imageData: ImageData): string | null {
  const qr = decodeQrFromImageData(imageData);
  if (qr && isReceiptScanPayload(qr)) {
    return qr;
  }

  const barcode = decodeBarcodeFromImageData(imageData);
  if (barcode && isReceiptScanPayload(barcode)) {
    return barcode;
  }

  return null;
}

/** Decode any QR on the frame (merchant pay, receive, or receipt). */
export function decodeAnyQrFromImageData(imageData: ImageData): string | null {
  return decodeQrFromImageData(imageData);
}
