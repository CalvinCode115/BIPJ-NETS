const period = require('./period');
const {
  aggregateTagStats,
  tagAmount,
  tagVisits,
  topMerchantsForTag,
} = require('./merchant-tags');

function round2(value) {
  return Math.round(value * 100) / 100;
}

function shareFor(totals, key, totalSpent) {
  if (!totalSpent) return 0;
  return (totals[key] || 0) / totalSpent;
}

function buildInsightContext(expenses, month, year) {
  const lifestyle = expenses.filter((row) => row.amount < 0 && row.category !== 'Transfer');
  const categoryTotals = {};
  lifestyle.forEach((row) => {
    categoryTotals[row.category] = (categoryTotals[row.category] || 0) + Math.abs(row.amount);
  });
  const tagStats = aggregateTagStats(lifestyle);
  const totalSpent = tagStats.totalSpent;
  const monthLabel = `${period.shortMonth(month)} ${year}`;

  return {
    expenses: lifestyle,
    categoryTotals,
    tagStats,
    totalSpent,
    month,
    year,
    monthLabel,
    tagAmount: (tag) => tagAmount(tagStats, tag),
    tagVisits: (tag) => tagVisits(tagStats, tag),
    topMerchants: (tag, limit) => topMerchantsForTag(tagStats, tag, limit),
    categoryShare: (category) => shareFor(categoryTotals, category, totalSpent),
    tagShare: (tag) => (totalSpent ? tagAmount(tagStats, tag) / totalSpent : 0),
  };
}

function deriveDnaTraits(ctx) {
  const candidates = [
    {
      name: 'Travel Explorer',
      score:
        ctx.tagAmount('travel_flight') + ctx.tagAmount('travel_hotel') >= 80
          ? ctx.tagAmount('travel_flight') + ctx.tagAmount('travel_hotel')
          : 0,
    },
    {
      name: 'Wellness Focused',
      score:
        ctx.tagAmount('retail_pharmacy') + (ctx.categoryTotals['Health'] || 0) >= 35
          ? ctx.tagAmount('retail_pharmacy') + (ctx.categoryTotals['Health'] || 0)
          : 0,
    },
    {
      name: 'Home Chef',
      score: ctx.categoryShare('Groceries') >= 0.22 ? ctx.categoryTotals['Groceries'] || 0 : 0,
    },
    {
      name: 'Savvy Shopper',
      score:
        ctx.tagAmount('retail_fashion') >= 40 || ctx.categoryShare('Retail') >= 0.28
          ? ctx.tagAmount('retail_fashion') || ctx.categoryTotals['Retail'] || 0
          : 0,
    },
    {
      name: 'Active Lifestyle',
      score: ctx.tagAmount('retail_sports') >= 30 ? ctx.tagAmount('retail_sports') : 0,
    },
    {
      name: 'Food Explorer',
      score: ctx.categoryShare('Dining') >= 0.22 ? ctx.categoryTotals['Dining'] || 0 : 0,
    },
    {
      name: 'Coffee Lover',
      score:
        ctx.tagAmount('drink_coffee') >= 18 || ctx.tagVisits('drink_coffee') >= 3
          ? ctx.tagAmount('drink_coffee')
          : 0,
    },
    {
      name: 'Bubble Tea Fan',
      score:
        ctx.tagAmount('drink_bubble_tea') >= 12 || ctx.tagVisits('drink_bubble_tea') >= 2
          ? ctx.tagAmount('drink_bubble_tea')
          : 0,
    },
    {
      name: 'Kopitiam Regular',
      score:
        ctx.tagAmount('drink_milo') + ctx.tagAmount('food_hawker') >= 35
          ? ctx.tagAmount('drink_milo') + ctx.tagAmount('food_hawker')
          : 0,
    },
    {
      name: 'On-the-go Commuter',
      score: ctx.categoryShare('Transport') >= 0.18 ? ctx.categoryTotals['Transport'] || 0 : 0,
    },
    {
      name: 'Budget Conscious',
      score: ctx.totalSpent > 0 && ctx.totalSpent <= 300 ? 300 - ctx.totalSpent : 0,
    },
  ];

  const traits = candidates
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.name);

  if (traits.length === 0) traits.push('Balanced Spender');
  return traits.slice(0, 4);
}

function merchantPhrase(names) {
  if (!names.length) return 'your favourite spots';
  if (names.length === 1) return names[0];
  return `${names[0]} and ${names[1]}`;
}

const INSIGHT_TEMPLATES = [
  {
    id: 'bubble_tea',
    theme: 'drinks',
    score: (ctx) => {
      const amount = ctx.tagAmount('drink_bubble_tea');
      return amount >= 6 ? amount * 1.35 + ctx.tagVisits('drink_bubble_tea') * 4 : 0;
    },
    build: (ctx) => ({
      title: 'Bubble Tea Mood',
      message: `You spent $${round2(ctx.tagAmount('drink_bubble_tea'))} on bubble tea in ${ctx.monthLabel} — ${merchantPhrase(ctx.topMerchants('drink_bubble_tea'))} lead the list.`,
      icon: 'water',
      color: '#e84393',
      bg: '#fce4ef',
    }),
  },
  {
    id: 'coffee',
    theme: 'drinks',
    score: (ctx) => {
      const amount = ctx.tagAmount('drink_coffee');
      const bubble = ctx.tagAmount('drink_bubble_tea');
      if (amount < 8 || (bubble >= amount && bubble >= 6)) return 0;
      return amount * 1.1 + ctx.tagVisits('drink_coffee') * 3;
    },
    build: (ctx) => ({
      title: 'Coffee Habit',
      message: `You spent $${round2(ctx.tagAmount('drink_coffee'))} on coffee in ${ctx.monthLabel}.`,
      icon: 'cafe',
      color: '#eb5757',
      bg: '#fdecea',
    }),
  },
  {
    id: 'local_drinks',
    theme: 'drinks',
    score: (ctx) => {
      const amount = ctx.tagAmount('drink_milo') + ctx.tagAmount('drink_soy') + ctx.tagAmount('drink_juice');
      return amount >= 6 ? amount * 1.2 : 0;
    },
    build: (ctx) => ({
      title: 'Local Drinks',
      message: `Kopitiam-style drinks and soy or juice orders total $${round2(ctx.tagAmount('drink_milo') + ctx.tagAmount('drink_soy') + ctx.tagAmount('drink_juice'))} this month.`,
      icon: 'nutrition',
      color: '#d35400',
      bg: '#fef5e7',
    }),
  },
  {
    id: 'dining',
    theme: 'food',
    score: (ctx) => {
      const amount = ctx.categoryTotals['Dining'] || 0;
      return amount >= 15 ? amount : 0;
    },
    build: (ctx) => ({
      title: 'Meal Spending Pattern',
      message: `Dining accounts for $${round2(ctx.categoryTotals['Dining'] || 0)} of your ${period.shortMonth(ctx.month)} spending.`,
      icon: 'restaurant',
      color: '#27ae60',
      bg: '#e8f8ef',
    }),
  },
  {
    id: 'groceries',
    theme: 'groceries',
    score: (ctx) => {
      const amount = ctx.categoryTotals['Groceries'] || 0;
      return amount >= 25 ? amount * 1.15 : 0;
    },
    build: (ctx) => ({
      title: 'Home Chef',
      message: `Groceries reached $${round2(ctx.categoryTotals['Groceries'] || 0)} in ${ctx.monthLabel} — ${merchantPhrase(ctx.topMerchants('groceries'))}.`,
      icon: 'cart',
      color: '#27ae60',
      bg: '#e8f8ef',
    }),
  },
  {
    id: 'fashion',
    theme: 'retail',
    score: (ctx) => {
      const amount = ctx.tagAmount('retail_fashion');
      return amount >= 20 ? amount * 1.1 : 0;
    },
    build: (ctx) => ({
      title: 'Fashion Finds',
      message: `Clothing and fashion retail total $${round2(ctx.tagAmount('retail_fashion'))} — top picks include ${merchantPhrase(ctx.topMerchants('retail_fashion'))}.`,
      icon: 'shirt',
      color: '#f2994a',
      bg: '#fff4e6',
    }),
  },
  {
    id: 'pharmacy',
    theme: 'retail',
    score: (ctx) => {
      const amount = ctx.tagAmount('retail_pharmacy');
      return amount >= 12 ? amount * 1.05 : 0;
    },
    build: (ctx) => ({
      title: 'Health & Beauty',
      message: `Pharmacy and beauty spend is $${round2(ctx.tagAmount('retail_pharmacy'))} this month.`,
      icon: 'medkit',
      color: '#9b51e0',
      bg: '#f3e8ff',
    }),
  },
  {
    id: 'travel',
    theme: 'travel',
    score: (ctx) => {
      const amount =
        ctx.tagAmount('travel_flight') + ctx.tagAmount('travel_hotel') + ctx.tagAmount('travel_activity');
      return amount >= 50 ? amount : 0;
    },
    build: (ctx) => ({
      title: 'Trip Planner',
      message: `Travel bookings total $${round2(ctx.tagAmount('travel_flight') + ctx.tagAmount('travel_hotel') + ctx.tagAmount('travel_activity'))} — flights, hotels, and activities lead the pack.`,
      icon: 'airplane',
      color: '#2f80ed',
      bg: '#e8f4fd',
    }),
  },
  {
    id: 'wellness',
    theme: 'wellness',
    score: (ctx) => {
      const amount = (ctx.categoryTotals['Health'] || 0) + ctx.tagAmount('health_clinic');
      return amount >= 20 ? amount : 0;
    },
    build: (ctx) => ({
      title: 'Wellness Spend',
      message: `Health and wellness total $${round2((ctx.categoryTotals['Health'] || 0) + ctx.tagAmount('health_clinic'))} this month.`,
      icon: 'fitness',
      color: '#9b51e0',
      bg: '#f3e8ff',
    }),
  },
  {
    id: 'transport',
    theme: 'transport',
    score: (ctx) => {
      const amount = ctx.categoryTotals['Transport'] || 0;
      return amount >= 12 ? amount * 0.95 : 0;
    },
    build: (ctx) => ({
      title: 'Transport Optimization',
      message: `Transport spend is $${round2(ctx.categoryTotals['Transport'] || 0)} this month. Consider MRT for short CBD trips.`,
      icon: 'bus',
      color: '#6c63ff',
      bg: '#ede7f6',
    }),
  },
  {
    id: 'sports',
    theme: 'retail',
    score: (ctx) => {
      const amount = ctx.tagAmount('retail_sports');
      return amount >= 25 ? amount * 1.05 : 0;
    },
    build: (ctx) => ({
      title: 'Active Lifestyle',
      message: `Sports and outdoor retail reached $${round2(ctx.tagAmount('retail_sports'))} in ${ctx.monthLabel}.`,
      icon: 'bicycle',
      color: '#00b894',
      bg: '#e0f7f4',
    }),
  },
];

function pickSmartInsights(expenses, traits, month, year) {
  const ctx = buildInsightContext(expenses, month, year);
  const resolvedTraits = traits?.length ? traits : deriveDnaTraits(ctx);

  const ranked = INSIGHT_TEMPLATES.map((template) => ({
    template,
    score: template.score(ctx),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const usedThemes = new Set();

  for (const entry of ranked) {
    if (picked.length >= 3) break;
    if (usedThemes.has(entry.template.theme)) continue;
    usedThemes.add(entry.template.theme);
    picked.push(entry.template.build(ctx));
  }

  const topTrait =
    resolvedTraits.find((trait) => !picked.some((card) => card.title === trait)) ||
    resolvedTraits[0] ||
    'Balanced Spender';
  picked.push({
    title: topTrait,
    message:
      ctx.totalSpent > 0
        ? `Your top DNA trait this month is ${topTrait}.`
        : 'Scan or add transactions to unlock richer insights.',
    icon: 'trophy',
    color: '#00b894',
    bg: '#e0f7f4',
  });

  return picked.slice(0, 4);
}

module.exports = {
  buildInsightContext,
  deriveDnaTraits,
  pickSmartInsights,
};
