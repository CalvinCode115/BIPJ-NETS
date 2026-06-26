
export function receiptQrPayload(id) {
  return JSON.stringify({ type: 'nets_receipt', id });
}

export function receiptBarcodePayload(id) {
  const suffix = id.replace('receipt_generic_', '');
  return `NETS-RCP-${suffix}`;
}

export const RECEIPT_SPECS = [
  {
    id: 'receipt_generic_01',
    generic: true,
    template: 'thermal',
    scanType: 'qr',
    brandColor: '#009a93',
    outerColor: '#c6c6c6',
    slipWidth: 276,
    filename: 'receipt-generic-watsons.png',
    merchant: 'WATSONS',
    address: ['68 Orchard Road, #B2-01', 'Singapore 238839'],
    category: 'Retail',
    date: '23 Jun 2026  14:28',
    items: [['Facial Tissue 3-ply', '3.30'], ['Sunscreen SPF50', '9.00']],
    total: '12.30',
    paymentMethod: 'NETS Prepaid',
    cardMask: '****7890',
  },
  {
    id: 'receipt_generic_02',
    generic: true,
    template: 'thermal',
    scanType: 'qr',
    brandColor: '#005baa',
    outerColor: '#b4b4b4',
    slipWidth: 292,
    filename: 'receipt-generic-fairprice.png',
    merchant: 'NTUC FAIRPRICE',
    address: ['1 Marina Boulevard, #B1-01', 'Singapore 018989'],
    category: 'Groceries',
    date: '22 Jun 2026  19:05',
    items: [['Jasmine Rice 5kg', '8.90'], ['Fresh Milk 2L', '5.90'], ['Bananas 1kg', '2.80']],
    total: '17.60',
    paymentMethod: 'NETS Prepaid',
    cardMask: '****5678',
  },
  {
    id: 'receipt_generic_03',
    generic: true,
    template: 'thermal',
    scanType: 'qr',
    brandColor: '#00704a',
    outerColor: '#d2d2d2',
    slipWidth: 268,
    filename: 'receipt-generic-starbucks.png',
    merchant: 'STARBUCKS',
    address: ['Raffles Place', 'Singapore 048616'],
    category: 'Dining',
    date: '28 Jun 2026  14:34',
    items: [['Grande Latte', '6.50'], ['Extra Shot', '2.00']],
    total: '8.50',
    paymentMethod: 'NETS Prepaid',
    cardMask: '****5678',
  },
  {
    id: 'receipt_generic_04',
    generic: true,
    template: 'thermal',
    scanType: 'qr',
    brandColor: '#00b14f',
    outerColor: '#bcbcbc',
    slipWidth: 300,
    filename: 'receipt-generic-grab.png',
    merchant: 'GRAB',
    address: ['Trip · Bishan MRT → Raffles Place'],
    category: 'Transport',
    date: '20 Jun 2026  08:15',
    items: [['Base Fare', '12.00'], ['Platform Fee', '3.00']],
    total: '15.00',
    paymentMethod: 'NETS Prepaid',
    cardMask: '****4321',
  },
];

export function receiptScanPayload(spec) {
  return receiptQrPayload(spec.id);
}

export function toReceiptRecord(spec) {
  return {
    id: spec.id,
    imageFile: spec.filename,
    imageUrl: `assets/demo-receipts/${spec.filename}`,
    scanType: spec.scanType,
    scanPayload: receiptScanPayload(spec),
    merchant: spec.merchant,
    amount: parseFloat(spec.total),
    date: spec.date.split(/\s{2,}/)[0],
    dateTime: spec.date.replace(/\s{2,}/, ' '),
    category: spec.category,
    paymentMethod: spec.paymentMethod || 'NETS Prepaid',
    cardNumber: null,
    owner: null,
  };
}
