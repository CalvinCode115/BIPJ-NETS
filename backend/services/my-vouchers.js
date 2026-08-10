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

  // If eligibleCategories is set, it's a strict filter — even a wildcard
  // 'any' merchant match must still satisfy it. Without this, a voucher
  // like "any F&B merchant" (merchantIds: ['any'] + eligibleCategories:
  // ['Dining', 'Coffee', 'Drinks']) would match literally everything,
  // since 'any' alone used to short-circuit the OR below regardless of
  // category.
  if (eligibleCategories.length > 0) {
    return eligibleCategories.includes(category);
  }

  return merchantIds.includes('any') || merchantIds.includes(normalizedMerchant);
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
 * Validates a voucher and computes its discount WITHOUT writing anything —
 * safe to call before we know whether the payment will actually go
 * through (e.g. before the balance check). Follow up with
 * commitVoucherUsage() — but ONLY once the payment has actually
 * succeeded, never before.
 */
async function previewVoucherForPayment(userId, voucherInstanceId, { merchant, category, amount }) {
  const db = getFirestore();
  const instanceRef = userVouchersRef(db, userId).doc(voucherInstanceId);

  const instanceSnap = await instanceRef.get();
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

  const catalogSnap = await voucherCatalogRef(db).doc(instance.voucherId).get();
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

  return { ok: true, discountAmount, finalAmount };
}

/**
 * Marks a voucher as used. Call this ONLY after the payment has actually
 * succeeded (transaction saved, card debited) — never before. Re-checks
 * status/expiry inside the transaction in case anything changed between
 * the preview and now (e.g. a race with a second concurrent request using
 * the same voucher).
 */
async function commitVoucherUsage(userId, voucherInstanceId, { merchant, location }) {
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

    tx.update(instanceRef, {
      status: 'used',
      usedAt: new Date().toISOString(),
      usedMerchant: merchant,
      usedLocation: location || null,
    });

    return { ok: true };
  });
}

/**
 * Manual test-only helper (no discount/merchant validation) — lets you
 * mark a voucher used directly from the My Vouchers "Simulate Use" button,
 * without needing real payment context. The real flow uses
 * previewVoucherForPayment() + commitVoucherUsage() above instead.
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
  previewVoucherForPayment,
  commitVoucherUsage,
  markVoucherUsed,
};
