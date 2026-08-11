const MAX_POINTS_BALANCE = 5000;

/**
 * Given a user's current points balance and a requested points award,
 * returns how much can actually be credited without pushing the balance
 * over the 5000-point ceiling. Never returns a negative number.
 *
 * This is a SEPARATE cap from the 300-points/20-transactions daily
 * earning limit in points-budget.js — that one limits how fast points can
 * be earned per day; this one limits how many points a user can ever be
 * holding at once, regardless of how slowly they were earned.
 */
function capBalanceAward(currentPoints, requestedAmount) {
  const headroom = Math.max(0, MAX_POINTS_BALANCE - currentPoints);
  return Math.max(0, Math.min(requestedAmount, headroom));
}

module.exports = { capBalanceAward, MAX_POINTS_BALANCE };
