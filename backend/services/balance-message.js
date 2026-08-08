const cardUtils = require('./card-utils');

function formatBalanceLeft(card) {
  const normalized = cardUtils.normalizeCardRow(card);
  if (!normalized) {
    return '';
  }

  // Use multi_currency.SGD (via getAvailableFunds); bare `balance` was removed.
  const amount = Math.round(cardUtils.getAvailableFunds(normalized) * 100) / 100;
  if (cardUtils.isCreditCard(normalized)) {
    return `Available credit left: $${amount.toFixed(2)}.`;
  }

  return `Balance left: $${amount.toFixed(2)}.`;
}

module.exports = {
  formatBalanceLeft,
};
