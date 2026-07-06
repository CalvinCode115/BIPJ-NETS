const FOOD_MERCHANT_BUCKETS = {
  'Starbucks Raffles Place': 'Coffee',
  'Starbucks One Raffles': 'Coffee',
  'LiHO Tea': 'Bubble Tea',
  'Gong Cha': 'Bubble Tea',
  'Mr Bean': 'Soy Drinks',
  'Boost Juice': 'Juice',
  'Ichiban Sushi': 'Japanese',
  'Pizza Hut': 'Western',
  'Dough Culture': 'Western',
  'Ya Kun Kaya Toast': 'Chinese',
  'Killiney Kopitiam': 'Chinese',
  'Marina Bay Hawker': 'Chinese',
  'Toast Box': 'Chinese',
  'Din Tai Fung': 'Chinese',
};

const RETAIL_MERCHANT_BUCKETS = {
  'Uniqlo Orchard': 'Clothing',
  'H&M VivoCity': 'Clothing',
  'Muji Orchard': 'Clothing',
  'Cotton On': 'Clothing',
  'Decathlon Singapore': 'Sports',
  'Causeway Point': 'Clothing',
  'Guardian Pharmacy': 'Health & Beauty',
  'Unity Pharmacy': 'Health & Beauty',
  'Cold Storage': 'Groceries',
  'FairPrice Finest': 'Groceries',
  'NTUC FairPrice': 'Groceries',
  'Changi Airport Duty Free': 'Duty Free',
};

const TRAVEL_MERCHANT_BUCKETS = {
  AirAsia: 'Flights',
  Scoot: 'Flights',
  Agoda: 'Hotels',
  'Booking.com': 'Hotels',
  Klook: 'Activities',
};

const FOOD_PALETTE = ['#eb5757', '#f2994a', '#27ae60', '#2f80ed', '#9b51e0'];
const RETAIL_PALETTE = ['#eb5757', '#2f80ed', '#27ae60', '#f2994a', '#bdbdbd'];
const TRAVEL_PALETTE = ['#6c63ff', '#2f80ed', '#27ae60', '#f2994a', '#9b51e0'];

function round2(value) {
  return Math.round(value * 100) / 100;
}

function bucketFood(expense) {
  if (expense.category === 'Coffee' || expense.category === 'Drinks') {
    return FOOD_MERCHANT_BUCKETS[expense.merchant] || (expense.category === 'Drinks' ? 'Drinks' : 'Coffee');
  }
  if (expense.category === 'Dining') {
    return FOOD_MERCHANT_BUCKETS[expense.merchant] || 'Others';
  }
  return null;
}

function bucketRetail(expense) {
  if (!['Retail', 'Groceries'].includes(expense.category)) {
    return null;
  }
  if (RETAIL_MERCHANT_BUCKETS[expense.merchant]) {
    return RETAIL_MERCHANT_BUCKETS[expense.merchant];
  }
  if (expense.category === 'Groceries') {
    return 'Groceries';
  }
  return 'Others';
}

function bucketTravelWellness(expense) {
  if (expense.category === 'Travel') {
    for (const [key, label] of Object.entries(TRAVEL_MERCHANT_BUCKETS)) {
      if (expense.merchant.includes(key)) {
        return label;
      }
    }
    return 'Others';
  }
  if (expense.category === 'Health') {
    return 'Health & Wellness';
  }
  return null;
}

function aggregateBuckets(expenses, bucketFn) {
  const totals = {};
  expenses.forEach((row) => {
    const bucket = bucketFn(row);
    if (!bucket) {
      return;
    }
    totals[bucket] = (totals[bucket] || 0) + Math.abs(row.amount);
  });
  return totals;
}

function buildSegments(totals, palette, maxSegments = 5) {
  const total = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  if (!total) {
    return { total: 0, segments: [] };
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const primary = sorted.slice(0, maxSegments - 1);
  const remainder = sorted.slice(maxSegments - 1);
  const rows = [...primary];

  if (remainder.length) {
    const othersAmount = remainder.reduce((sum, [, amount]) => sum + amount, 0);
    rows.push(['Others', othersAmount]);
  }

  const segments = rows.map(([label, amount], index) => ({
    label,
    amount: round2(amount),
    percent: Math.round((amount / total) * 100),
    color: palette[index % palette.length],
  }));

  return { total: round2(total), segments };
}

function buildDeepDive(expenses, bucketFn, meta, palette) {
  const totals = aggregateBuckets(expenses, bucketFn);
  const { total, segments } = buildSegments(totals, palette);
  if (!total || !segments.length) {
    return null;
  }

  return {
    id: meta.id,
    heading: meta.heading,
    subtitle: meta.subtitle,
    icon: meta.icon,
    iconColor: meta.iconColor,
    iconBg: meta.iconBg,
    total,
    segments,
  };
}

function buildDeepDives(expenses) {
  const lifestyle = expenses.filter((row) => row.amount < 0 && row.category !== 'Transfer');

  const dives = [
    buildDeepDive(lifestyle, bucketFood, {
      id: 'food',
      heading: 'Food & Dining Deep Dive',
      subtitle: 'Spending by Cuisine',
      icon: 'cafe',
      iconColor: '#eb5757',
      iconBg: '#fdecea',
    }, FOOD_PALETTE),
    buildDeepDive(lifestyle, bucketRetail, {
      id: 'retail',
      heading: 'Retail Deep Dive',
      subtitle: 'Spending by Type',
      icon: 'bag',
      iconColor: '#27ae60',
      iconBg: '#e8f8ef',
    }, RETAIL_PALETTE),
    buildDeepDive(lifestyle, bucketTravelWellness, {
      id: 'travel',
      heading: 'Travel & Wellness Deep Dive',
      subtitle: 'Spending by Category',
      icon: 'airplane',
      iconColor: '#6c63ff',
      iconBg: '#ede7f6',
    }, TRAVEL_PALETTE),
  ].filter(Boolean);

  return dives;
}

function toLegacyDonut(deepDive) {
  return {
    title: deepDive.subtitle,
    total: deepDive.total || 1,
    segments: deepDive.segments.map(({ label, amount, color }) => ({ label, amount, color })),
  };
}

module.exports = {
  buildDeepDives,
  toLegacyDonut,
};
