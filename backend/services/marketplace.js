const { getFirestore } = require('../firebase/admin');
const {
  voucherCatalogRef,
  voucherRedemptionCountersRef,
  userPointsLedgerRef,
  userVouchersRef,
} = require('../db/firestore-paths');
const { getDateId, getWeekId } = require('./quests');

/** Counter doc id for a daily/weekly-limited voucher's current period. */
function counterDocId(voucherId, quantityLimitType) {
  if (quantityLimitType === 'daily') return `${voucherId}_${getDateId()}`;
  if (quantityLimitType === 'weekly') return `${voucherId}_${getWeekId()}`;
  return null; // 'none' and 'total' don't use period counters
}

function isEventLive(voucher) {
  if (voucher.type !== 'event') return true;
  const now = Date.now();
  const start = voucher.eventStartDate ? new Date(voucher.eventStartDate).getTime() : -Infinity;
  const end = voucher.eventEndDate ? new Date(voucher.eventEndDate).getTime() : Infinity;
  return now >= start && now <= end;
}

/**
 * Vouchers for the Marketplace page, with remaining-quantity info computed
 * for daily/weekly/total-limited vouchers so the UI can show "62 left
 * today" etc.
 *
 * Sort order: all currently-redeemable vouchers first (cheapest points
 * cost to most expensive), then anything not currently redeemable —
 * mainly event vouchers outside their date window, or sold-out limited
 * ones — pushed to the bottom, also cheapest-to-most-expensive within
 * that group.
 */
async function getMarketplaceVouchers() {
  const db = getFirestore();
  const catalogSnap = await voucherCatalogRef(db).where('active', '==', true).get();

  const vouchers = await Promise.all(
    catalogSnap.docs.map(async (doc) => {
      const voucher = doc.data();
      const eventLive = isEventLive(voucher);

      let remaining = null;
      let soldOut = false;

      if (voucher.quantityLimitType === 'daily' || voucher.quantityLimitType === 'weekly') {
        const counterId = counterDocId(doc.id, voucher.quantityLimitType);
        const counterSnap = await voucherRedemptionCountersRef(db).doc(counterId).get();
        const redeemedThisPeriod = counterSnap.exists ? counterSnap.data().count ?? 0 : 0;
        remaining = Math.max(0, voucher.quantityLimitAmount - redeemedThisPeriod);
        soldOut = remaining <= 0;
      } else if (voucher.quantityLimitType === 'total') {
        remaining = Math.max(0, voucher.quantityLimitAmount - (voucher.redeemedCount ?? 0));
        soldOut = remaining <= 0;
      }

      return {
        id: doc.id,
        ...voucher,
        remaining,
        soldOut,
        eventLive,
        redeemable: eventLive && !soldOut,
      };
    })
  );

  vouchers.sort((a, b) => {
    if (a.redeemable !== b.redeemable) {
      return a.redeemable ? -1 : 1; // redeemable ones first
    }
    return a.pointsCost - b.pointsCost; // then cheapest to most expensive
  });

  return { vouchers };
}

/**
 * Redeems a voucher for the given user: deducts points, logs a Points
 * History entry, creates the user's voucher instance (feeds My Vouchers),
 * and increments whatever quantity counter applies.
 */
async function redeemVoucher(userId, voucherId) {
  const db = getFirestore();
  const voucherRef = voucherCatalogRef(db).doc(voucherId);
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (tx) => {
    // ---- 1. READS ----
    const [voucherSnap, userSnap] = await Promise.all([tx.get(voucherRef), tx.get(userRef)]);

    if (!voucherSnap.exists) {
      return { ok: false, error: 'Voucher not found.' };
    }
    const voucher = voucherSnap.data();

    if (!voucher.active) {
      return { ok: false, error: 'This voucher is no longer available.' };
    }
    if (!isEventLive(voucher)) {
      return { ok: false, error: 'This event voucher is not currently active.' };
    }

    const currentPoints = userSnap.exists ? userSnap.data().points ?? 0 : 0;
    if (currentPoints < voucher.pointsCost) {
      return { ok: false, error: 'Not enough points to redeem this voucher.' };
    }

    let counterRef = null;
    let redeemedThisPeriod = 0;
    if (voucher.quantityLimitType === 'daily' || voucher.quantityLimitType === 'weekly') {
      counterRef = voucherRedemptionCountersRef(db).doc(counterDocId(voucherId, voucher.quantityLimitType));
      const counterSnap = await tx.get(counterRef);
      redeemedThisPeriod = counterSnap.exists ? counterSnap.data().count ?? 0 : 0;
      if (redeemedThisPeriod >= voucher.quantityLimitAmount) {
        return { ok: false, error: 'This voucher is sold out for this period.' };
      }
    } else if (voucher.quantityLimitType === 'total') {
      const redeemedCount = voucher.redeemedCount ?? 0;
      if (redeemedCount >= voucher.quantityLimitAmount) {
        return { ok: false, error: 'This voucher is sold out.' };
      }
    }

    // ---- 2. WRITES ----
    const redeemedAt = new Date();
    const expiresAt = new Date(redeemedAt.getTime() + voucher.validityDays * 24 * 60 * 60 * 1000);

    tx.update(userRef, { points: currentPoints - voucher.pointsCost });

    tx.set(userPointsLedgerRef(db, userId).doc(), {
      title: `Redeemed ${voucher.merchantName} ${voucher.description}`,
      amount: -voucher.pointsCost,
      type: 'redemption',
      tag: 'Redemption',
      icon: voucher.icon ?? 'gift-outline',
      timestamp: redeemedAt.toISOString(),
    });

    const voucherInstanceRef = userVouchersRef(db, userId).doc();
    tx.set(voucherInstanceRef, {
      voucherId,
      merchantName: voucher.merchantName,
      description: voucher.description,
      icon: voucher.icon ?? 'gift-outline',
      pointsCost: voucher.pointsCost,
      redeemedAt: redeemedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'available',
      usedAt: null,
      usedMerchant: null,
      usedLocation: null,
      termsAndConditions: voucher.termsAndConditions ?? [],
      usageSteps: voucher.usageSteps ?? [],
    });

    if (counterRef) {
      tx.set(counterRef, { count: redeemedThisPeriod + 1 }, { merge: true });
    } else if (voucher.quantityLimitType === 'total') {
      tx.update(voucherRef, { redeemedCount: (voucher.redeemedCount ?? 0) + 1 });
    }

    return { ok: true, voucherInstanceId: voucherInstanceRef.id, pointsSpent: voucher.pointsCost };
  });
}

module.exports = {
  getMarketplaceVouchers,
  redeemVoucher,
};
