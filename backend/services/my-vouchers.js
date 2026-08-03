const { getFirestore } = require('../firebase/admin');
const { userVouchersRef, voucherCatalogRef } = require('../db/firestore-paths');

function normalizeMerchant(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * How much a voucher discounts a given payment amount by. Never exceeds
 * the payment amount itself (can't discount below $0).
 */
function computeDiscount(catalogVoucher, amount) {
  if (catalogVoucher.discountType === 'flat') {
    return Math.min(catalogVoucher.discountValue, amount);
  }
  if (catalogVoucher.discountType === 'percentage') {
    const raw = amount * (catalogVoucher.discountValue / 100);
    const capped = catalogVoucher.discountCap != null ? Math.min(raw, catalogVoucher.discountCap) : raw;
    return Math.round(Math.min(capped, amount) * 100) / 100;
  }
  return 0; // 'none' — a non-cash perk (e.g. free topping), doesn't reduce the amount
}

function merchantOrCategoryMatches(catalogVoucher, normalizedMerchant, category) {
  const merchantIds = catalogVoucher.merchantIds ?? [];
  const eligibleCategories = catalogVoucher.eligibleCategories ?? [];
  const merchantMatch = merchantIds.includes('any') || merchantIds.includes(normalizedMerchant);
  const categoryMatch = eligibleCategories.length > 0 && eligibleCategories.includes(category);
  return merchantMatch || categoryMatch;
}

/**
 * Called by the Pay/QR flow right after a merchant + amount are known but
 * BEFORE the payment is confirmed. Returns every voucher the user holds
 * that's relevant to this specific merchant/category — each flagged with
 * whether the current transaction meets its conditions, and (if so) the
 * actual discount + final amount so the popup can show
 * "you'll pay $13.90 instead of $18.90".
 */
async function checkEligibleVouchers(userId, { merchant, category, amount }) {
  const db = getFirestore();
  const normalizedMerchant = normalizeMerchant(merchant);

  const instancesSnap = await userVouchersRef(db, userId).where('status', '==', 'available').get();
  const now = Date.now();
  const activeInstances = instancesSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((v) => new Date(v.expiresAt).getTime() >= now);

  if (activeInstances.length === 0) {
    return { matches: [] };
  }

  const catalogIds = [...new Set(activeInstances.map((v) => v.voucherId))];
  const catalogDocs = await Promise.all(catalogIds.map((id) => voucherCatalogRef(db).doc(id).get()));
  const catalogById = new Map(catalogDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]));

  const matches = [];
  for (const instance of activeInstances) {
    const catalog = catalogById.get(instance.voucherId);
    if (!catalog) continue;
    if (!merchantOrCategoryMatches(catalog, normalizedMerchant, category)) continue;

    const minSpend = catalog.minSpend ?? null;
    const meetsConditions = minSpend === null || amount >= minSpend;
    const discountAmount = meetsConditions ? computeDiscount(catalog, amount) : 0;

    matches.push({
      voucherInstanceId: instance.id,
      merchantName: instance.merchantName,
      description: instance.description,
      icon: instance.icon,
      termsAndConditions: instance.termsAndConditions,
      minSpend,
      meetsConditions,
      discountAmount,
      finalAmount: meetsConditions ? Math.round((amount - discountAmount) * 100) / 100 : null,
      message: meetsConditions
        ? null
        : `Spend at least $${minSpend.toFixed(2)} to use this voucher (currently $${amount.toFixed(2)}).`,
    });
  }

  return { matches };
}

/**
 * Lists a user's redeemed vouchers, split into Available / Used / Expired.
 *
 * "Expired" is computed at read time (status stays 'available' in
 * Firestore until actually used) — same approach as partnerChallenges'
 * isExpired, for consistency. A voucher is effectively expired if it's
 * still 'available' but its expiresAt has passed.
 */
async function getUserVouchers(userId) {
  const db = getFirestore();
  const snap = await userVouchersRef(db, userId).orderBy('redeemedAt', 'desc').get();
  const now = Date.now();

  const available = [];
  const used = [];
  const expired = [];

  snap.docs.forEach((doc) => {
    const voucher = { id: doc.id, ...doc.data() };

    if (voucher.status === 'used') {
      used.push(voucher);
      return;
    }

    const isPastExpiry = new Date(voucher.expiresAt).getTime() < now;
    if (isPastExpiry) {
      expired.push({ ...voucher, status: 'expired' });
    } else {
      available.push(voucher);
    }
  });

  return { available, used, expired };
}

/**
 * THE REAL "apply this voucher to this payment" function — validates
 * everything server-side (never trusts a client-computed discount),
 * marks the voucher used, and returns the discount/final amount for the
 * caller (the QR payment route) to actually charge.
 *
 * This does NOT create the transaction itself — that stays entirely in
 * your groupmate's existing payment code. This function only validates,
 * computes the discount, and marks the voucher used. The route calling
 * this is responsible for using `finalAmount` when building the
 * transaction instead of the original amount.
 */
async function applyVoucherToPayment(userId, voucherInstanceId, { merchant, category, amount, location }) {
  const db = getFirestore();
  const instanceRef = userVouchersRef(db, userId).doc(voucherInstanceId);

  return db.runTransaction(async (tx) => {
    const instanceSnap = await tx.get(instanceRef);
    if (!instanceSnap.exists) {
      return { ok: false, error: 'Voucher not found.' };
    }
    const instance = instanceSnap.data();

    if (instance.status === 'used') {
      return { ok: false, error: 'Voucher already used.' };
    }
    if (new Date(instance.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'Voucher has expired.' };
    }

    const catalogSnap = await tx.get(voucherCatalogRef(db).doc(instance.voucherId));
    if (!catalogSnap.exists) {
      return { ok: false, error: 'Voucher definition not found.' };
    }
    const catalog = catalogSnap.data();

    const normalizedMerchant = normalizeMerchant(merchant);
    if (!merchantOrCategoryMatches(catalog, normalizedMerchant, category)) {
      return { ok: false, error: 'This voucher is not valid for this merchant.' };
    }

    if (catalog.minSpend != null && amount < catalog.minSpend) {
      return { ok: false, error: `Spend at least $${catalog.minSpend.toFixed(2)} to use this voucher.` };
    }

    const discountAmount = computeDiscount(catalog, amount);
    const finalAmount = Math.round((amount - discountAmount) * 100) / 100;

    tx.update(instanceRef, {
      status: 'used',
      usedAt: new Date().toISOString(),
      usedMerchant: merchant,
      usedLocation: location || null,
    });

    return { ok: true, discountAmount, finalAmount };
  });
}

/**
 * Manual test-only helper (no discount/merchant validation) — lets you
 * mark a voucher used directly from the My Vouchers "Simulate Use" button,
 * without needing real payment context. The real flow uses
 * applyVoucherToPayment() above instead.
 */
async function markVoucherUsed(userId, voucherInstanceId, { merchant, location }) {
  const db = getFirestore();
  const ref = userVouchersRef(db, userId).doc(voucherInstanceId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { ok: false, error: 'Voucher not found.' };
    }

    const voucher = snap.data();
    if (voucher.status === 'used') {
      return { ok: false, error: 'Voucher already used.' };
    }
    if (new Date(voucher.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'Voucher has expired.' };
    }

    tx.update(ref, {
      status: 'used',
      usedAt: new Date().toISOString(),
      usedMerchant: merchant || voucher.merchantName,
      usedLocation: location || null,
    });

    return { ok: true };
  });
}

module.exports = {
  getUserVouchers,
  checkEligibleVouchers,
  applyVoucherToPayment,
  markVoucherUsed,
};
