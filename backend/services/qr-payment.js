const period = require('./period');
const fs = require('fs');
const { PAY_QR_MERCHANTS } = require('../data/catalog-paths');

function loadPayQrMerchants() {
  if (!fs.existsSync(PAY_QR_MERCHANTS)) {
    return [];
  }
  const data = JSON.parse(fs.readFileSync(PAY_QR_MERCHANTS, 'utf8'));
  return (data.merchants || []).map(({ id, merchant, amount, category, location }) => ({
    id,
    merchant,
    amount,
    category,
    location,
  }));
}

/**
 * Simulates NETS QR payment payloads for merchant checkout.
 */

const PAY_QR_CATALOG = loadPayQrMerchants();

function buildPayPayload(merchant) {
  return JSON.stringify({
    type: 'nets_pay',
    id: merchant.id,
    merchant: merchant.merchant,
    amount: merchant.amount,
    category: merchant.category,
  });
}

function parseReceivePayload(json) {
  if (json.type !== 'nets_receive' || !json.userId) {
    return null;
  }

  return {
    userId: json.userId,
    name: json.name || 'NETS User',
    phone: json.phone || '',
  };
}

function parseQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return { ok: false, error: 'Empty QR code.' };
  }

  if (text.startsWith('{')) {
    try {
      const json = JSON.parse(text);
      if (json.type === 'nets_receive') {
        const receive = parseReceivePayload(json);
        if (!receive) {
          return { ok: false, error: 'Invalid receive QR format.' };
        }
        return { ok: true, kind: 'receive', receive };
      }

      if (json.type === 'nets_pay' || json.merchant) {
        const payment = normalizePayment(json);
        if (!payment) {
          return { ok: false, error: 'Invalid payment QR format.' };
        }
        return { ok: true, kind: 'pay', payment };
      }
    } catch {
      return { ok: false, error: 'Invalid payment QR format.' };
    }
  }

  if (text.startsWith('nets://pay')) {
    try {
      const query = text.includes('?') ? text.split('?')[1] : '';
      const params = new URLSearchParams(query);
      const payment = normalizePayment({
        id: params.get('id') || 'qr_custom',
        merchant: params.get('merchant') || 'Merchant',
        amount: parseFloat(params.get('amount') || '0'),
        category: params.get('category') || 'Retail',
      });
      if (!payment) {
        return { ok: false, error: 'Invalid payment URL.' };
      }
      return { ok: true, kind: 'pay', payment };
    } catch {
      return { ok: false, error: 'Invalid payment URL.' };
    }
  }

  const matched = PAY_QR_CATALOG.find(
    (entry) => text === entry.id || text.includes(entry.id)
  );
  if (matched) {
    return { ok: true, kind: 'pay', payment: normalizePayment(matched) };
  }

  return { ok: false, error: 'This QR code is not a supported NETS payment.' };
}

function normalizePayment(input) {
  const amount = Math.abs(parseFloat(input.amount));
  if (!input.merchant || Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  return {
    id: input.id || `qr_${Date.now()}`,
    merchant: input.merchant,
    amount: Math.round(amount * 100) / 100,
    category: input.category || 'Retail',
    location: input.location || null,
  };
}

function buildReceivePayload(user) {
  return JSON.stringify({
    type: 'nets_receive',
    userId: user.id,
    name: user.name,
    phone: user.phone,
  });
}

function createTransactionFromQr(userId, payment, card) {
  const icons = {
    Coffee: { icon: 'cafe', icon_color: '#2f80ed' },
    Drinks: { icon: 'water', icon_color: '#e84393' },
    Dining: { icon: 'restaurant', icon_color: '#eb5757' },
    Retail: { icon: 'shirt', icon_color: '#f2994a' },
    Groceries: { icon: 'cart', icon_color: '#27ae60' },
    Transport: { icon: 'car', icon_color: '#9b51e0' },
  };
  const meta = icons[payment.category] || { icon: 'qr-code', icon_color: '#6c63ff' };

  return {
    id: `txn_${Date.now()}`,
    user_id: userId,
    card_id: card.id,
    merchant: payment.merchant,
    category: payment.category,
    subtitle: 'QR payment',
    amount: -payment.amount,
    txn_type: 'debit',
    icon: meta.icon,
    icon_color: meta.icon_color,
    occurred_at: period.nowSingaporeIso(),
  };
}

module.exports = {
  PAY_QR_CATALOG,
  DEMO_MERCHANT_QRS: PAY_QR_CATALOG,
  buildPayPayload,
  buildReceivePayload,
  parseQrPayload,
  createTransactionFromQr,
};
