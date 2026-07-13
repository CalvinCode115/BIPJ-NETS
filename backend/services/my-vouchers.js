const { getFirestore } = require('../firebase/admin');
const { userVouchersRef } = require('../db/firestore-paths');

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
 * ⚠️ TEST/DEV CONVENIENCE ONLY — this simulates what the future Pay/QR
 * auto-apply hook is meant to do automatically the moment a user pays a
 * merchant with a matching available voucher (see the "Auto-apply during
 * QR payment" section of the rewards system overview doc). Until that hook
 * is actually built into the Pay flow, call this manually to test the Used
 * tab in My Vouchers. Once the real hook exists, this endpoint can either
 * be removed or left as an admin/support tool.
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
  markVoucherUsed,
};
