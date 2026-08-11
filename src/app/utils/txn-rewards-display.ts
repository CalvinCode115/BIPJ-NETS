/** Display rates for Option A (derive from spend amount — not persisted). */
export const DISPLAY_POINTS_PER_DOLLAR = 1;
export const DISPLAY_XP_PER_DOLLAR = 10;

export interface TxnRewardsEstimate {
  points: number;
  xp: number;
}

export interface TxnRewardsDisplay extends TxnRewardsEstimate {
  limitLabel: string | null;
}

export interface TxnRewardsSource {
  amount: number;
  type?: string;
  category?: string;
  pointsAwarded?: number | null;
  pointsCapped?: boolean;
  pointsRecorded?: boolean;
  xpGained?: number | null;
  xpCapped?: boolean;
  xpRecorded?: boolean;
}

/**
 * Estimate pts/XP shown on a transaction row from the spend amount.
 * Merchant debits earn pts + XP. Outgoing PayNow/P2P earn XP only.
 * Credits, incoming transfers, and exchanges earn nothing here.
 */
export function estimateTxnRewards(
  amount: number,
  type?: string,
  category?: string
): TxnRewardsEstimate {
  if (type === 'credit' || type === 'exchange') {
    return { points: 0, xp: 0 };
  }
  // Spending is stored as a negative amount
  if (!(amount < 0)) {
    return { points: 0, xp: 0 };
  }

  const spend = Math.abs(amount);
  if (category === 'Transfer') {
    return {
      points: 0,
      xp: Math.round(spend * DISPLAY_XP_PER_DOLLAR),
    };
  }

  return {
    points: Math.round(spend * DISPLAY_POINTS_PER_DOLLAR),
    xp: Math.round(spend * DISPLAY_XP_PER_DOLLAR),
  };
}

/**
 * Prefer persisted grants when present. Old rows without those fields
 * keep the amount-based estimate. A fully-capped new txn shows a label
 * instead of +0.
 */
export function resolveTxnRewardsDisplay(txn: TxnRewardsSource): TxnRewardsDisplay {
  const estimate = estimateTxnRewards(txn.amount, txn.type, txn.category);
  const points = txn.pointsRecorded ? Number(txn.pointsAwarded ?? 0) : estimate.points;
  const xp = txn.xpRecorded ? Number(txn.xpGained ?? 0) : estimate.xp;
  const cappedToZero =
    (Boolean(txn.pointsRecorded) && Boolean(txn.pointsCapped) && Number(txn.pointsAwarded ?? 0) === 0) ||
    (Boolean(txn.xpRecorded) && Boolean(txn.xpCapped) && Number(txn.xpGained ?? 0) === 0);

  if (points === 0 && xp === 0 && cappedToZero) {
    const xpOnly = txn.category === 'Transfer' || (Boolean(txn.xpRecorded) && !txn.pointsRecorded);
    return {
      points: 0,
      xp: 0,
      limitLabel: xpOnly ? 'Daily XP limit' : 'Daily limit',
    };
  }

  return { points, xp, limitLabel: null };
}
