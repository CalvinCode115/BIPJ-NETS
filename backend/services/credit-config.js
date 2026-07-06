const MAX_CREDIT_LIMIT = 3000;

function clampCreditLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return MAX_CREDIT_LIMIT;
  }
  return Math.min(Math.round(parsed), MAX_CREDIT_LIMIT);
}

module.exports = {
  MAX_CREDIT_LIMIT,
  clampCreditLimit,
};
