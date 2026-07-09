const CATEGORY_COLORS = {
  Food: '#f2994a',
  Dining: '#f2994a',
  Coffee: '#2f80ed',
  Drinks: '#e84393',
  Transport: '#eb5757',
  Retail: '#27ae60',
  Groceries: '#27ae60',
  Health: '#9b51e0',
  Transfer: '#6c63ff',
  Travel: '#6c63ff',
  Health: '#9b51e0',
};

const CATEGORY_ICONS = {
  Coffee: { icon: 'cafe', iconColor: '#2f80ed' },
  Drinks: { icon: 'water', iconColor: '#e84393' },
  Dining: { icon: 'restaurant', iconColor: '#eb5757' },
  Groceries: { icon: 'cart', iconColor: '#27ae60' },
  Transport: { icon: 'car', iconColor: '#9b51e0' },
  Retail: { icon: 'shirt', iconColor: '#f2994a' },
  Transfer: { icon: 'arrow-down-circle', iconColor: '#27ae60' },
  Travel: { icon: 'bed', iconColor: '#6c63ff' },
  Health: { icon: 'medkit', iconColor: '#9b51e0' },
};

const period = require('./period');
const { buildDeepDives, toLegacyDonut } = require('./insight-deep-dives');
const { aggregateTagStats } = require('./merchant-tags');
const { deriveDnaTraits, pickSmartInsights } = require('./insight-engine');
const { buildTopSpots } = require('./top-spots');

function mapCategoryToSpendingLabel(category) {
  const map = {
    Coffee: 'Food',
    Drinks: 'Food',
    Dining: 'Food',
    Groceries: 'Retail',
    Retail: 'Retail',
    Transport: 'Transit',
    Health: 'Health',
    Travel: 'Travel',
  };
  return map[category] || 'Others';
}

function lifestyleExpenses(transactions) {
  return transactions.filter((t) => t.amount < 0 && t.category !== 'Transfer');
}

function buildDnaProfile(userId, transactions) {
  const expenses = lifestyleExpenses(transactions);
  const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const categoryTotals = {};
  const merchantCounts = {};

  expenses.forEach((t) => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
    merchantCounts[t.merchant] = (merchantCounts[t.merchant] || 0) + 1;
  });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      share: totalSpent ? round2(amount / totalSpent) : 0,
    }));

  const topMerchants = Object.entries(merchantCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, visits]) => ({ name, visits }));

  const tagStats = aggregateTagStats(expenses);
  const traits = deriveDnaTraits({
    categoryTotals,
    tagStats,
    totalSpent,
    categoryShare: (category) => shareFor(categoryTotals, category, totalSpent),
    tagAmount: (tag) => tagStats.totals[tag]?.amount || 0,
    tagVisits: (tag) => tagStats.totals[tag]?.visits || 0,
  });

  const diningShare = shareFor(categoryTotals, 'Dining', totalSpent);
  const coffeeShare = shareFor(categoryTotals, 'Coffee', totalSpent);
  const transportShare = shareFor(categoryTotals, 'Transport', totalSpent);
  const travelShare = shareFor(categoryTotals, 'Travel', totalSpent);

  const preferredCuisines = [];
  if (categoryTotals['Japanese'] || merchantCounts['Ichiban Sushi']) preferredCuisines.push('Japanese');
  if (coffeeShare > 0) preferredCuisines.push('Coffee');
  if (diningShare > 0) preferredCuisines.push('Local Dining');
  if (travelShare > 0) preferredCuisines.push('Regional Travel');

  const budgetStyle = totalSpent > 800 ? 'premium' : totalSpent > 400 ? 'moderate' : 'budget';

  return {
    userId,
    traits,
    topCategories,
    topMerchants: topMerchants.map((m) => m.name),
    avgDailySpend: round2(totalSpent / 30),
    travelHints: {
      preferredCuisines: preferredCuisines.length ? preferredCuisines : ['Local Dining'],
      budgetStyle,
      typicalTripSpend: round2(totalSpent * 1.2),
    },
    updatedAt: new Date().toISOString(),
  };
}

const DAY_BAR_COLORS = ['#2f80ed', '#6c63ff', '#9b51e0', '#27ae60', '#f2994a', '#eb5757', '#3498db'];

function buildWeeklyDayBreakdown(expenses, referenceDate = new Date()) {
  const { start } = period.weekRange(referenceDate);
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      label: period.formatDayShort(date),
      amount: 0,
      color: DAY_BAR_COLORS[index % DAY_BAR_COLORS.length],
    };
  });

  expenses.forEach((row) => {
    const date = period.parseOccurredAt(row.occurred_at);
    for (let index = 0; index < 7; index += 1) {
      const bucketDate = new Date(start);
      bucketDate.setDate(start.getDate() + index);
      if (
        date.getFullYear() === bucketDate.getFullYear() &&
        date.getMonth() === bucketDate.getMonth() &&
        date.getDate() === bucketDate.getDate()
      ) {
        buckets[index].amount += Math.abs(row.amount);
        break;
      }
    }
  });

  return buckets.map((bucket) => ({
    ...bucket,
    amount: round2(bucket.amount),
  }));
}

function buildDashboard(user, cards, transactions, dnaProfile, selectedPeriod, periodType = 'monthly') {
  const { month, year } = selectedPeriod || {
    month: period.CURRENT_MONTH,
    year: period.CURRENT_YEAR,
  };
  const currentTransactions =
    periodType === 'weekly'
      ? period.filterByCurrentWeek(transactions)
      : period.filterByMonth(transactions, month, year);
  const previous =
    periodType === 'weekly'
      ? null
      : period.shiftMonth(month, year, -1);
  const previousTransactions =
    periodType === 'weekly'
      ? period.filterByPreviousWeek(transactions)
      : period.filterByMonth(transactions, previous.month, previous.year);

  const expenses = currentTransactions.filter((t) => t.amount < 0);
  const income = currentTransactions.filter((t) => t.amount > 0);
  const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalIn = income.reduce((sum, t) => sum + t.amount, 0);
  const previousSpent = previousTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const previousIn = previousTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const spendingMap = {};
  expenses.forEach((t) => {
    const label = mapCategoryToSpendingLabel(t.category);
    spendingMap[label] = (spendingMap[label] || 0) + Math.abs(t.amount);
  });

  const spendingCategories =
    periodType === 'weekly'
      ? buildWeeklyDayBreakdown(expenses)
      : Object.entries(spendingMap).map(([label, amount]) => ({
          label,
          amount: round2(amount),
          color: CATEGORY_COLORS[label] || '#bdbdbd',
        }));

  const diningAmount = spendingMap['Food'] || 0;
  const insight =
    diningAmount > 80
      ? {
          title: 'High dining spend detected',
          message:
            "You've spent more on dining this month. Consider using your linked DBS card for restaurant cashback.",
        }
      : {
          title: 'Spending looks steady',
          message: 'Your spending this month is in line with your usual pattern. Keep it up!',
        };

  const activePrepaid = cards.find((c) => c.card_type === 'prepaid');

  return {
    user: {
      id: user.id,
      name: user.name.split(' ')[0],
      fullName: user.name,
      phone: user.phone,
      tier: user.tier,
      points: user.points,
    },
    accountTabs: [
      { id: 'prepaid', label: 'PREPAID' },
      { id: 'cashcard', label: 'CASHCARD' },
      { id: 'others', label: 'OTHERS' },
    ],
    cardsByType: {
      prepaid: cards.filter((c) => c.card_type === 'prepaid'),
      cashcard: cards.filter((c) => c.card_type === 'cashcard'),
      others: cards.filter((c) => c.card_type === 'others'),
    },
    defaultCard: activePrepaid || cards[0] || null,
    monthlySummary: {
      month: periodType === 'weekly' ? period.weekLabel() : period.monthLabel(month, year),
      totalIn: round2(totalIn),
      totalInChange: percentChange(totalIn, previousIn),
      totalSpent: round2(totalSpent),
      totalSpentChange: percentChange(totalSpent, previousSpent),
    },
    spendingCategories,
    insight,
    recentTransactions: currentTransactions.slice(0, 5).map(formatTransaction),
    rewards: {
      currentPoints: user.points,
      targetPoints: 5000,
    },
    dnaTraits: dnaProfile.traits,
    selectedPeriod: {
      month,
      year,
      label: periodType === 'weekly' ? period.weekLabel() : period.monthLabel(month, year),
      periodType,
    },
  };
}

function buildTransactionSummary(transactions, month, year) {
  const monthTransactions = period.filterByMonth(transactions, month, year);
  const expenses = monthTransactions.filter((t) => t.amount < 0);
  const totalSpending = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const days = period.daysInMonth(month, year);

  return {
    month: period.shortMonth(month),
    monthLabel: period.monthLabel(month, year),
    totalSpending: round2(totalSpending),
    transactionCount: monthTransactions.length,
    avgPerDay: round2(totalSpending / days),
  };
}

function buildReport(userId, allTransactions, month, year) {
  const monthTransactions = period.filterByMonth(allTransactions, month, year);
  const expenses = monthTransactions.filter((t) => t.amount < 0);
  const income = monthTransactions.filter((t) => t.amount > 0);
  const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalIn = income.reduce((sum, t) => sum + t.amount, 0);
  const previous = period.shiftMonth(month, year, -1);
  const previousExpenses = period
    .filterByMonth(allTransactions, previous.month, previous.year)
    .filter((t) => t.amount < 0);
  const previousSpent = previousExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const previousIncome = period
    .filterByMonth(allTransactions, previous.month, previous.year)
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const trendMonths = [];
  for (let offset = -4; offset <= 0; offset += 1) {
    const target = period.shiftMonth(month, year, offset);
    const rows = period.filterByMonth(allTransactions, target.month, target.year);
    const spending = rows
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const monthIncome = rows.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    trendMonths.push({
      label: period.shortMonth(target.month),
      spending: round2(spending),
      income: round2(monthIncome),
    });
  }

  const categoryTotals = {};
  expenses.forEach((t) => {
    const label = mapCategoryToSpendingLabel(t.category);
    categoryTotals[label] = (categoryTotals[label] || 0) + Math.abs(t.amount);
  });

  const categories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount: round2(amount),
      change: 0,
      color: CATEGORY_COLORS[name] || '#bdbdbd',
      percent: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
    }));

  const netSaved = round2(totalIn - totalSpent);
  const avgTransaction = monthTransactions.length
    ? round2(totalSpent / Math.max(expenses.length, 1))
    : 0;

  return {
    userId,
    reportPeriod: period.monthLabel(month, year),
    selectedPeriod: { month, year, label: period.monthLabel(month, year) },
    availablePeriods: period.listAvailablePeriods(allTransactions),
    stats: [
      {
        label: 'Total In',
        value: `$${totalIn.toFixed(2)}`,
        badge: `${percentChange(totalIn, previousIncome)}%`,
        badgeType: totalIn >= previousIncome ? 'positive' : 'negative',
      },
      {
        label: 'Total Spent',
        value: `$${totalSpent.toFixed(2)}`,
        badge: `${percentChange(totalSpent, previousSpent)}%`,
        badgeType: totalSpent <= previousSpent ? 'positive' : 'negative',
      },
      {
        label: 'Avg. Transaction',
        value: `$${avgTransaction.toFixed(2)}`,
        badge: 'Live',
        badgeType: 'neutral',
      },
      {
        label: 'Net Saved',
        value: `$${netSaved.toFixed(2)}`,
        badge: netSaved >= 0 ? 'On track' : 'Deficit',
        badgeType: netSaved >= 0 ? 'positive' : 'negative',
      },
    ],
    trendMonths,
    categories,
    netSaved,
    savingsGoalProgress: totalIn ? Math.min(100, Math.round((netSaved / totalIn) * 100)) : 0,
    compareLabel: period.previousMonthLabel(month, year),
  };
}

function buildInsights(allTransactions, month, year) {
  const monthTransactions = period.filterByMonth(allTransactions, month, year);
  const summary = buildTransactionSummary(allTransactions, month, year);
  const expenses = monthTransactions.filter((t) => t.amount < 0);
  const categoryTotals = {};

  expenses.forEach((t) => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
  });

  const foodTotal = round2(
    (categoryTotals['Coffee'] || 0) + (categoryTotals['Drinks'] || 0) + (categoryTotals['Dining'] || 0)
  );
  const shoppingTotal = round2(
    (categoryTotals['Retail'] || 0) +
      (categoryTotals['Groceries'] || 0) +
      (categoryTotals['Travel'] || 0) +
      (categoryTotals['Health'] || 0)
  );

  const deepDives = buildDeepDives(expenses);
  const foodDeepDive = deepDives.find((d) => d.id === 'food');
  const retailDeepDive = deepDives.find((d) => d.id === 'retail');

  const topSpots = buildTopSpots(expenses);

  const dnaProfile = buildDnaProfile('insights', monthTransactions);

  return {
    summaryMonth: period.monthLabel(month, year),
    selectedPeriod: { month, year, label: period.monthLabel(month, year) },
    availablePeriods: period.listAvailablePeriods(allTransactions),
    summaryStats: [
      { label: 'Total Spent', value: `$${summary.totalSpending.toFixed(2)}` },
      { label: 'Transactions', value: String(summary.transactionCount) },
      { label: 'Avg/Day', value: `$${summary.avgPerDay.toFixed(2)}` },
    ],
    foodDonut: foodDeepDive
      ? toLegacyDonut(foodDeepDive)
      : {
          title: 'Spending by Cuisine',
          total: foodTotal || 1,
          segments: buildDonutSegments(categoryTotals, ['Coffee', 'Drinks', 'Dining'], foodTotal || 1),
        },
    shoppingDonut: retailDeepDive
      ? toLegacyDonut(retailDeepDive)
      : {
          title: 'Spending by Type',
          total: shoppingTotal || 1,
          segments: buildDonutSegments(
            categoryTotals,
            ['Retail', 'Groceries', 'Travel', 'Health'],
            shoppingTotal || 1
          ),
        },
    deepDives,
    topSpots,
    transportAnalysis: buildTransportAnalysis(expenses),
    smartInsights: pickSmartInsights(monthTransactions, dnaProfile.traits, month, year),
    traits: dnaProfile.traits,
  };
}

function buildTransportAnalysis(expenses) {
  const transportRows = expenses.filter((t) => t.category === 'Transport');
  const total = round2(transportRows.reduce((sum, t) => sum + Math.abs(t.amount), 0));
  const merchantTotals = {};

  transportRows.forEach((t) => {
    merchantTotals[t.merchant] = merchantTotals[t.merchant] || { amount: 0, trips: 0 };
    merchantTotals[t.merchant].amount += Math.abs(t.amount);
    merchantTotals[t.merchant].trips += 1;
  });

  const top = Object.entries(merchantTotals).sort((a, b) => b[1].amount - a[1].amount)[0];

  return {
    totalTransport: total,
    totalTrips: transportRows.length,
    highlight: top
      ? `Most used: ${top[0]} (${top[1].trips} trips, $${round2(top[1].amount)})`
      : 'No transport spend recorded this month.',
  };
}

function buildDonutSegments(totals, keys, total) {
  const palette = ['#eb5757', '#f2994a', '#27ae60', '#6c63ff', '#bdbdbd'];
  return keys
    .filter((key) => totals[key])
    .map((key, index) => ({
      label: key,
      amount: round2(totals[key]),
      color: palette[index % palette.length],
    }))
    .concat(
      Object.keys(totals)
        .filter((key) => !keys.includes(key))
        .slice(0, 1)
        .map((key, index) => ({
          label: 'Others',
          amount: round2(totals[key]),
          color: palette[(keys.length + index) % palette.length],
        }))
    );
}

function createTransactionFromReceipt(userId, receipt, card) {
  const meta = CATEGORY_ICONS[receipt.category] || { icon: 'receipt', iconColor: '#6c63ff' };

  return {
    id: `txn_${Date.now()}`,
    user_id: userId,
    card_id: card.id,
    merchant: receipt.merchant,
    category: receipt.category,
    subtitle: 'Receipt scan',
    amount: -Math.abs(receipt.amount),
    txn_type: 'debit',
    icon: meta.icon,
    icon_color: meta.iconColor,
    occurred_at: period.nowSingaporeIso(),
  };
}

function percentChange(current, previous) {
  if (!previous) {
    return current ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function formatTransaction(row) {
  const date = period.parseOccurredAt(row.occurred_at);
  const counterparty = resolveTransferCounterparty(row);

  return {
    id: row.id,
    merchant: row.merchant,
    subtitle: row.subtitle,
    amount: row.amount,
    date: date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: period.SINGAPORE_TZ }),
    time: date.toLocaleTimeString('en-SG', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: period.SINGAPORE_TZ,
    }),
    icon: row.icon,
    iconColor: row.icon_color,
    type: row.txn_type,
    category: row.category,
    cardId: row.card_id,
    counterparty,
  };
}

function resolveTransferCounterparty(row) {
  if (row.category !== 'Transfer') {
    return null;
  }

  if (row.transfer_direction && (row.counterparty_phone || row.counterparty_name)) {
    return {
      direction: row.transfer_direction,
      phone: row.counterparty_phone ? formatTransferPhone(row.counterparty_phone) : undefined,
      name: row.counterparty_name || undefined,
    };
  }

  const match = String(row.subtitle || '').match(/^(From|To)\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const direction = match[1].toLowerCase();
  const value = match[2].trim();
  const digits = value.replace(/\D/g, '').slice(-8);

  if (digits.length === 8) {
    return {
      direction,
      phone: formatTransferPhone(value),
      name: row.counterparty_name || undefined,
    };
  }

  return {
    direction,
    name: value,
    phone: row.counterparty_phone ? formatTransferPhone(row.counterparty_phone) : undefined,
  };
}

function formatTransferPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-8);
  if (digits.length !== 8) {
    return String(phone || '');
  }
  return `+65 ${digits.slice(0, 4)} ${digits.slice(4)}`;
}

function shareFor(totals, category, totalSpent) {
  if (!totalSpent) return 0;
  return (totals[category] || 0) / totalSpent;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  buildDnaProfile,
  buildDashboard,
  buildTransactionSummary,
  buildReport,
  buildInsights,
  createTransactionFromReceipt,
  formatTransaction,
  CATEGORY_ICONS,
};
