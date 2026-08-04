const fs = require('fs');
const { PAY_QR_MERCHANTS } = require('../data/catalog-paths');

function normalizeMerchant(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Seed / receipt merchants not always present in QR catalog. */
const STATIC_MERCHANT_TAGS = {
  airasia: ['travel_flight'],
  scoot: ['travel_flight'],
  agoda: ['travel_hotel'],
  'booking.com': ['travel_hotel'],
  klook: ['travel_activity'],
  grab: ['transport_ride'],
  'simplygo transit': ['transport_transit'],
  watsons: ['retail_pharmacy'],
  'ntuc fairprice': ['groceries'],
  starbucks: ['drink_coffee'],
  'causeway point': ['retail_fashion'],
  'unity pharmacy': ['retail_pharmacy'],
  'raffles medical': ['health_clinic'],
  'guardian pharmacy': ['retail_pharmacy'],
};

const CATEGORY_FALLBACK_TAGS = {
  Coffee: ['drink_coffee'],
  Drinks: ['drink_other'],
  Dining: ['food_casual'],
  Groceries: ['groceries'],
  Retail: ['retail_other'],
  Transport: ['transport_other'],
  Travel: ['travel_other'],
  Health: ['health_wellness'],
};

function loadQrMerchantTags() {
  const registry = {};
  if (!fs.existsSync(PAY_QR_MERCHANTS)) {
    return registry;
  }

  const data = JSON.parse(fs.readFileSync(PAY_QR_MERCHANTS, 'utf8'));
  (data.merchants || []).forEach((entry) => {
    if (entry.tags?.length) {
      registry[normalizeMerchant(entry.merchant)] = entry.tags;
    }
  });
  return registry;
}

let qrMerchantTags = loadQrMerchantTags();

function reloadMerchantTags() {
  qrMerchantTags = loadQrMerchantTags();
}

function resolveMerchantTags(merchant, category) {
  const key = normalizeMerchant(merchant);
  if (qrMerchantTags[key]?.length) {
    return qrMerchantTags[key];
  }
  if (STATIC_MERCHANT_TAGS[key]?.length) {
    return STATIC_MERCHANT_TAGS[key];
  }
  return CATEGORY_FALLBACK_TAGS[category] || [];
}

function aggregateTagStats(expenses) {
  const lifestyle = expenses.filter((row) => row.amount < 0 && row.category !== 'Transfer');
  const totals = {};
  let totalSpent = 0;

  lifestyle.forEach((row) => {
    const amount = Math.abs(row.amount);
    totalSpent += amount;
    const tags = resolveMerchantTags(row.merchant, row.category);
    tags.forEach((tag) => {
      if (!totals[tag]) {
        totals[tag] = { amount: 0, visits: 0, merchants: {} };
      }
      totals[tag].amount += amount;
      totals[tag].visits += 1;
      totals[tag].merchants[row.merchant] = (totals[tag].merchants[row.merchant] || 0) + amount;
    });
  });

  Object.values(totals).forEach((entry) => {
    entry.amount = round2(entry.amount);
  });

  return { totals, totalSpent: round2(totalSpent) };
}

function tagAmount(tagStats, tag) {
  return tagStats.totals[tag]?.amount || 0;
}

function tagVisits(tagStats, tag) {
  return tagStats.totals[tag]?.visits || 0;
}

function topMerchantsForTag(tagStats, tag, limit = 2) {
  const merchants = tagStats.totals[tag]?.merchants || {};
  return Object.entries(merchants)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  normalizeMerchant,
  resolveMerchantTags,
  aggregateTagStats,
  tagAmount,
  tagVisits,
  topMerchantsForTag,
  reloadMerchantTags,
};
