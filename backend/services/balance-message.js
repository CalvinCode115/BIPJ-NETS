const cardUtils = require('./card-utils');

function formatBalanceLeft(card) {
  const normalized = cardUtils.normalizeCardRow(card);
  if (!normalized) {
    return '';
  }

  const amount = Math.round(Number(normalized.balance) * 100) / 100;
  if (cardUtils.isCreditCard(normalized)) {
    return `Available credit left: $${amount.toFixed(2)}.`;
  }

  return `Balance left: $${amount.toFixed(2)}.`;
}

module.exports = {
  formatBalanceLeft,
};
