/** Display rates for Option A (derive from spend amount — not persisted). */
export const DISPLAY_POINTS_PER_DOLLAR = 10;
export const DISPLAY_XP_PER_DOLLAR = 10;

export interface TxnRewardsEstimate {
  points: number;
  xp: number;
}

/**
 * Estimate pts/XP shown on a transaction row from the spend amount.
 * Merchant debits only — credits, transfers, and exchanges earn nothing here.
 */
export function estimateTxnRewards(
  amount: number,
  type?: string,
  category?: string
): TxnRewardsEstimate {
  if (type === 'credit' || type === 'exchange') {
    return { points: 0, xp: 0 };
  }
  if (category === 'Transfer') {
    return { points: 0, xp: 0 };
  }
  // Spending is stored as a negative amount
  if (!(amount < 0)) {
    return { points: 0, xp: 0 };
  }

  const spend = Math.abs(amount);
  return {
    points: Math.round(spend * DISPLAY_POINTS_PER_DOLLAR),
    xp: Math.round(spend * DISPLAY_XP_PER_DOLLAR),
  };
}
