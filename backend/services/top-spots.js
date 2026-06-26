/** Merchants excluded from AI Insights "Top Spots" (funding / transfers, not retail spend). */

const EXCLUDED_CATEGORIES = new Set(['Transfer']);

const EXCLUDED_MERCHANT_PATTERNS = [
  /^prepaid top-up$/i,
  /^nets prepaid top-up$/i,
  /^paynow transfer$/i,
  /^salary \/ payroll$/i,
];

function isTopSpotCandidate(transaction) {
  if (!transaction || transaction.amount >= 0) {
    return false;
  }

  if (EXCLUDED_CATEGORIES.has(transaction.category)) {
    return false;
  }

  const merchant = String(transaction.merchant || '').trim();
  if (!merchant) {
    return false;
  }

  return !EXCLUDED_MERCHANT_PATTERNS.some((pattern) => pattern.test(merchant));
}

function buildTopSpots(expenses, limit = 4) {
  const merchantTotals = {};

  expenses.forEach((row) => {
    if (!isTopSpotCandidate(row)) {
      return;
    }

    merchantTotals[row.merchant] = merchantTotals[row.merchant] || {
      amount: 0,
      visits: 0,
      category: row.category,
    };
    merchantTotals[row.merchant].amount += Math.abs(row.amount);
    merchantTotals[row.merchant].visits += 1;
  });

  return Object.entries(merchantTotals)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, limit)
    .map(([name, data], index) => ({
      rank: index + 1,
      name,
      amount: round2(data.amount),
      category: data.category,
      visits: data.visits,
    }));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  isTopSpotCandidate,
  buildTopSpots,
};
