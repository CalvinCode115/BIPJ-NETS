/**
 * Receipt scan catalog for Home (scan receipt / add transaction).
 * Images: src/assets/demo-receipts/ — regenerate with npm run generate:assets
 */

const fs = require('fs');
const { HOME_RECEIPTS } = require('../data/catalog-paths');

function loadHomeReceipts() {
  if (!fs.existsSync(HOME_RECEIPTS)) {
    return [];
  }
  const data = JSON.parse(fs.readFileSync(HOME_RECEIPTS, 'utf8'));
  return data.receipts || [];
}

const RECEIPT_CATALOG = loadHomeReceipts();

function receiptFromScanPayload(scanPayload) {
  if (!scanPayload) {
    return null;
  }

  const exact = RECEIPT_CATALOG.find((entry) => entry.scanPayload === scanPayload);
  if (exact) {
    return exact;
  }

  try {
    const json = JSON.parse(scanPayload);
    if (json.type === 'nets_receipt' && json.id) {
      return RECEIPT_CATALOG.find((entry) => entry.id === json.id) ?? null;
    }
  } catch {
    // plain barcode text
  }

  return RECEIPT_CATALOG.find((entry) => entry.scanPayload === String(scanPayload).trim()) ?? null;
}

function receiptFromFilenameSeed(imageSeed) {
  const seed = String(imageSeed).toLowerCase();

  return (
    RECEIPT_CATALOG.find((entry) => {
      const base = entry.imageFile.replace('.png', '').toLowerCase();
      return seed.includes(entry.id.toLowerCase()) || seed.includes(base) || seed.includes(entry.imageFile.toLowerCase());
    }) ?? null
  );
}

function resolveScan(payload = {}) {
  const receiptId = payload.receiptId;
  const scanPayload = payload.scanPayload;
  const imageSeed = payload.imageSeed;

  if (receiptId) {
    const receipt = RECEIPT_CATALOG.find((entry) => entry.id === receiptId);
    if (!receipt) {
      return { ok: false, error: 'Unknown receipt.' };
    }

    return {
      ok: true,
      source: 'receipt_catalog',
      message: 'Receipt loaded. Review details before saving.',
      receipt: formatReceipt(receipt),
    };
  }

  if (scanPayload) {
    const codeMatch = receiptFromScanPayload(scanPayload);
    if (codeMatch) {
      const via = codeMatch.scanType === 'barcode' ? 'Barcode' : 'QR code';
      return {
        ok: true,
        source: 'receipt_catalog',
        message: `${via} on receipt recognised. Review details before saving.`,
        receipt: formatReceipt(codeMatch),
      };
    }
  }

  if (imageSeed) {
    const filenameMatch = receiptFromFilenameSeed(imageSeed);
    if (filenameMatch) {
      return {
        ok: true,
        source: 'receipt_catalog',
        message: 'Receipt recognised from image file. Review details before saving.',
        receipt: formatReceipt(filenameMatch),
      };
    }
  }

  if (scanPayload || imageSeed) {
    return {
      ok: false,
      error: 'Could not read a barcode or QR code on this receipt. Centre the code in frame or choose a clearer photo.',
    };
  }

  return { ok: false, error: 'Provide scanPayload from a receipt barcode/QR, or a receipt image.' };
}

function formatReceipt(receipt) {
  return {
    id: receipt.id,
    imageUrl: receipt.imageUrl,
    merchant: receipt.merchant,
    amount: receipt.amount,
    date: receipt.date,
    dateTime: receipt.dateTime || receipt.date,
    category: receipt.category,
    paymentMethod: receipt.paymentMethod,
    cardNumber: receipt.cardNumber || null,
    owner: receipt.owner || null,
  };
}

module.exports = {
  RECEIPT_CATALOG,
  DEMO_RECEIPTS: RECEIPT_CATALOG,
  resolveScan,
  formatReceipt,
  receiptFromScanPayload,
};
