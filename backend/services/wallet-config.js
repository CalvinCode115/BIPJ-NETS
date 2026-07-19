/** Auto top-up toggle turns on when prepaid / CashCard balance is below this amount (SGD). */
const LOW_BALANCE_THRESHOLD = 50;
/** Demo safeguards for manual wallet top-ups (SGD). */
const MIN_TOP_UP_AMOUNT = 1;
const MAX_TOP_UP_AMOUNT = 500;
const MAX_WALLET_BALANCE = 5000;
const SOURCE_CARD_RESERVE = 50;

module.exports = {
  LOW_BALANCE_THRESHOLD,
  MIN_TOP_UP_AMOUNT,
  MAX_TOP_UP_AMOUNT,
  MAX_WALLET_BALANCE,
  SOURCE_CARD_RESERVE,
};
