/**
 * Which card types may pay for which spend contexts.
 *
 * Prepaid  — retail, ride-hail (Grab/taxi); NOT gantry transit (MRT/bus/ERP/carpark)
 * CashCard — gantry transit + NETS retail; NOT ride-hail app payments
 * Others   — general payments including ride-hail
 */

const GANTRY_PATTERNS = [
  /simplygo/i,
  /\bmrt\b/i,
  /\bbus fare\b/i,
  /\bbus\b/i,
  /\berp\b/i,
  /carpark/i,
  /car park/i,
  /parking gantry/i,
  /transit fare/i,
  /cepas/i,
];

const RIDEHAIL_PATTERNS = [/grab/i, /\btaxi\b/i, /comfortdelgro/i, /comfort cab/i, /gojek/i, /ryde/i, /tada/i];

function classifySpendContext(merchant, category, subtitle) {
  const text = `${merchant || ''} ${subtitle || ''}`.trim();

  if (RIDEHAIL_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'ride_hail';
  }

  if (GANTRY_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'gantry';
  }

  if (String(category || '').toLowerCase() === 'transport') {
    return 'gantry';
  }

  return 'general';
}

function canSpendOnCard(card, context) {
  if (!card) {
    return false;
  }

  const cardType = card.card_type;

  if (context === 'gantry') {
    return cardType === 'cashcard';
  }

  if (context === 'ride_hail') {
    return cardType === 'prepaid' || cardType === 'others';
  }

  return ['prepaid', 'cashcard', 'others'].includes(cardType);
}

function spendBlockMessage(card, context) {
  const label =
    card.card_type === 'prepaid'
      ? 'NETS Prepaid'
      : card.card_type === 'cashcard'
        ? 'NETS CashCard'
        : 'This card';

  if (context === 'gantry' && card.card_type === 'prepaid') {
    return `${label} cannot pay MRT, bus, ERP, or carpark fares. Use your NETS CashCard instead.`;
  }

  if (context === 'gantry' && card.card_type === 'others') {
    return `${label} cannot pay gantry transit fares. Use your NETS CashCard instead.`;
  }

  if (context === 'ride_hail' && card.card_type === 'cashcard') {
    return `${label} cannot pay Grab or taxi in the app. Use NETS Prepaid or a linked debit/credit card.`;
  }

  return `${label} cannot be used for this payment.`;
}

module.exports = {
  classifySpendContext,
  canSpendOnCard,
  spendBlockMessage,
};
