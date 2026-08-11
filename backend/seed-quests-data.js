/**
 * Seed data for Daily Quests, Weekly Quests, and Partner Challenges.
 * Merged into Firestore by scripts/seed-firestore.js alongside seed-data.js's
 * users/cards/transactions.
 *
 * NOTE: re-running the seed script resets `participantCount`/`completedCount`
 * on partnerChallenges back to these defaults (matching how cards/balances
 * are recomputed on every seed run elsewhere in this project). Don't re-run
 * `npm run db:seed` on a live demo you want to keep real usage stats on.
 */

const dailyQuestTemplates = {
  'daily-coffee-run': {
    title: 'Coffee Run',
    description: 'Make a coffee purchase',
    icon: 'cafe-outline',
    family: 'category-fnb', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 1,
    rewards: [{ label: '[Buff] Energized', style: 'buff' }],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    requirementMeta: { category: 'Coffee' },
    active: true,
  },
  'daily-big-spender': {
    title: 'Big Spender',
    description: 'Spend over $50',
    icon: 'bag-handle-outline',
    family: 'spend-amount', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 8,
    rewards: [{ label: 'Rare Cosmetic Chance', style: 'rare' }],
    requirementType: 'spend_amount',
    requirementTarget: 50,
    active: true,
  },
  'daily-explorer': {
    title: 'Explorer',
    description: 'Visit a new merchant',
    icon: 'location-outline',
    family: 'new-merchant', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 4,
    rewards: [{ label: '+5 Pet Happiness', style: 'pet' }],
    requirementType: 'visit_new_merchant',
    requirementTarget: 1,
    active: true,
  },
  'daily-first-transaction': {
    title: 'First Transaction of the Day',
    description: 'Make your first transaction today',
    icon: 'flash-outline',
    family: 'any-transaction', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 2,
    rewards: [{ label: '+100 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    active: true,
  },
  'daily-penny-saver': {
    title: 'Penny Saver',
    description: 'Transaction under $5',
    icon: 'wallet-outline',
    family: 'small-transaction', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 1,
    rewards: [],
    requirementType: 'transaction_under_amount',
    requirementTarget: 1, // completes on ONE qualifying transaction, not cumulative spend
    requirementMeta: { maxAmount: 5 },
    active: true,
  },
  'daily-checkin-streak': {
    title: 'Mix It Up',
    description: 'Spend in 2 different merchant categories today',
    icon: 'sparkles-outline',
    family: 'category-diversity', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 2,
    rewards: [],
    requirementType: 'merchant_category_count',
    requirementTarget: 2,
    active: true,
  },
  'daily-lunch-run': {
    title: 'Lunch Run',
    description: 'Make a purchase between 11am–2pm',
    icon: 'restaurant-outline',
    family: 'time-window', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 2,
    rewards: [{ label: '+50 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    requirementMeta: { category: ['Dining', 'Coffee', 'Drinks'], hourRange: [11, 14] },
    active: true,
  },
  'daily-transport-tap': {
    title: 'Transport Tap',
    description: 'Pay for a ride or transit fare',
    icon: 'bus-outline',
    family: 'category-transport', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 1,
    rewards: [],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    requirementMeta: { category: 'Transport' },
    active: true,
  },
  'daily-triple-transaction': {
    title: 'Triple Threat',
    description: 'Make 3 transactions today',
    icon: 'repeat-outline',
    family: 'any-transaction', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 4,
    rewards: [{ label: '+75 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 3,
    active: true,
  },
  'daily-retail-therapy': {
    title: 'Retail Therapy',
    description: 'Make a retail purchase',
    icon: 'pricetag-outline',
    family: 'category-retail', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 2,
    rewards: [],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    requirementMeta: { category: 'Retail' },
    active: true,
  },
  'daily-mid-spender': {
    title: 'Mid-Range Spender',
    description: 'Spend over $20 today',
    icon: 'cash-outline',
    family: 'spend-amount', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 3,
    rewards: [{ label: '+10 Pet Happiness', style: 'pet' }],
    requirementType: 'spend_amount',
    requirementTarget: 20,
    active: true,
  },
  'daily-neighbourhood-explorer': {
    title: 'Neighbourhood Explorer',
    description: 'Visit 2 new merchants today',
    icon: 'compass-outline',
    family: 'new-merchant', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 7,
    rewards: [{ label: 'Rare Cosmetic Chance', style: 'rare' }],
    requirementType: 'visit_new_merchant',
    requirementTarget: 2,
    active: true,
  },
  'daily-early-bird': {
    title: 'Early Bird',
    description: 'Make a purchase before 9am',
    icon: 'sunny-outline',
    family: 'time-window', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 2,
    rewards: [{ label: '[Buff] Energized', style: 'buff' }],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    requirementMeta: { hourRange: [0, 9] },
    active: true,
  },
  'daily-night-owl': {
    title: 'Night Owl',
    description: 'Make a purchase after 9pm',
    icon: 'moon-outline',
    family: 'time-window', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 2,
    rewards: [],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    requirementMeta: { hourRange: [21, 24] },
    active: true,
  },
  'daily-beverage-break': {
    title: 'Beverage Break',
    description: 'Buy a drink from a beverage store',
    icon: 'beer-outline',
    family: 'category-fnb', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 1,
    rewards: [{ label: '+30 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 1,
    requirementMeta: { category: ['Drinks', 'Coffee'] },
    active: true,
  },
};

const weeklyQuestTemplates = {
  'weekly-diverse-spender': {
    title: 'Diverse Spender',
    description: 'Transactions in 5 different merchant categories',
    icon: 'cart-outline',
    family: 'category-diversity', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 15,
    rewards: [
      { label: '+500 XP', style: 'xp' },
      { label: "'Variety Seeker' Badge", style: 'badge' },
    ],
    requirementType: 'merchant_category_count',
    requirementTarget: 5,
    requirementMeta: {
      allowedCategories: ['Dining', 'Retail', 'Groceries', 'Transport', 'Travel'],
      categoryAliases: { Coffee: 'Dining', Drinks: 'Dining' },
    },
    active: true,
  },
  'weekly-streak-keeper': {
    title: 'Streak Keeper',
    description: 'Make 1 transaction every day for 7 days',
    icon: 'flame-outline',
    family: 'streak', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 20,
    rewards: [{ label: 'Legendary Cosmetic Unlock', style: 'legendary' }],
    requirementType: 'streak_day',
    requirementTarget: 7,
    active: true,
  },
  'weekly-retail-week': {
    title: 'Retail Week',
    description: 'Make 3 retail purchases this week',
    icon: 'pricetag-outline',
    family: 'category-retail', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 12,
    rewards: [{ label: '+300 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 3,
    requirementMeta: { category: 'Retail' },
    active: true,
  },
  'weekly-big-week': {
    title: 'Big Week',
    description: '$100 total spend',
    icon: 'trending-up-outline',
    family: 'spend-amount', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 10,
    rewards: [{ label: '+300 XP', style: 'xp' }],
    requirementType: 'spend_amount',
    requirementTarget: 100,
    active: true,
  },
  'weekly-frequent-flyer': {
    title: 'Frequent Flyer',
    description: 'Make 15 transactions this week',
    icon: 'repeat-outline',
    family: 'any-transaction', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 15,
    rewards: [{ label: '+400 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 15,
    active: true,
  },
  'weekly-foodie-tour': {
    title: 'Foodie Tour',
    description: 'Make 5 F&B purchases this week',
    icon: 'restaurant-outline',
    family: 'category-fnb', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 12,
    rewards: [{ label: 'Foodie Pet Theme', style: 'badge' }],
    requirementType: 'transaction_count',
    requirementTarget: 5,
    requirementMeta: { category: ['Dining', 'Coffee', 'Drinks'] },
    active: true,
  },
  'weekly-explorer-plus': {
    title: 'Explorer+',
    description: 'Visit 5 new merchants this week',
    icon: 'compass-outline',
    family: 'new-merchant', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 18,
    rewards: [{ label: 'Rare Cosmetic Unlock', style: 'rare' }],
    requirementType: 'visit_new_merchant',
    requirementTarget: 5,
    active: true,
  },
  'weekly-commuter': {
    title: 'Commuter Champion',
    description: 'Pay for 3 transport fares this week',
    icon: 'bus-outline',
    family: 'category-transport', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 8,
    rewards: [{ label: '+350 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 3,
    requirementMeta: { category: 'Transport' },
    active: true,
  },
  'weekly-big-spender-plus': {
    title: 'Big Spender+',
    description: 'Spend over $200 this week',
    icon: 'cash-outline',
    family: 'spend-amount', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 22,
    rewards: [{ label: 'Legendary Cosmetic Unlock', style: 'legendary' }],
    requirementType: 'spend_amount',
    requirementTarget: 200,
    active: true,
  },
  'weekly-grocery-grab': {
    title: 'Grocery Grab',
    description: 'Make 3 grocery purchases this week',
    icon: 'basket-outline',
    family: 'category-groceries', // used to keep the daily/weekly rotation from picking near-duplicate quests
    points: 12,
    rewards: [{ label: '+300 XP', style: 'xp' }],
    requirementType: 'transaction_count',
    requirementTarget: 3,
    requirementMeta: { category: 'Groceries' },
    active: true,
  },
};

const partnerChallenges = {
  // ---- Permanent (2) — always available, never expires ----
  'bubble-tea-buddy': {
    merchantName: 'Bubble Tea Buddy',
    description: 'Visit 3 different bubble tea or drink stores: LiHO Tea, Gong Cha, Mr Bean, or Boost Juice.',
    progressUnitLabel: 'stores',
    icon: 'cafe-outline',
    difficulty: 'easy',
    durationType: 'permanent',
    requirementType: 'visit_count_at_merchants',
    requirementTarget: 3,
    requirementMeta: {
      merchantIds: ['liho tea', 'gong cha', 'mr bean', 'boost juice'],
    },
    points: 8,
    rewards: [
      { label: 'Bubble Tea Lover Badge', style: 'badge' },
      { label: 'LiHO Tea $1 Voucher', style: 'voucher' },
    ],
    grantVoucherId: 'liho-1-dollar-voucher',
    participantCount: 0,
    completedCount: 0,
    active: true,
  },
  'grocery-run-challenge': {
    merchantName: 'Grocery Run Challenge',
    description: 'Spend $30 in total at NTUC FairPrice, Cold Storage, or FairPrice Finest.',
    icon: 'cart-outline',
    difficulty: 'easy',
    durationType: 'permanent',
    requirementType: 'spend_amount_at_merchant',
    requirementTarget: 30,
    requirementMeta: {
      merchantIds: ['ntuc fairprice', 'cold storage', 'fairprice finest'],
    },
    points: 6,
    rewards: [{ label: 'Grocery Saver Badge', style: 'badge' }],
    participantCount: 0,
    completedCount: 0,
    active: true,
  },

  // ---- Monthly (2) — progress resets on the 1st of each month ----
  'fashion-refresh': {
    merchantName: 'Fashion Refresh',
    description: 'Visit 2 different fashion stores: Uniqlo, H&M, Cotton On, or Muji.',
    progressUnitLabel: 'stores',
    icon: 'shirt-outline',
    difficulty: 'average',
    durationType: 'monthly',
    requirementType: 'visit_count_at_merchants',
    requirementTarget: 2,
    requirementMeta: {
      merchantIds: ['uniqlo orchard', 'h&m vivocity', 'cotton on', 'muji orchard'],
    },
    points: 15,
    rewards: [
      { label: 'Trendsetter Badge', style: 'badge' },
      { label: 'Cotton On $15 Voucher', style: 'voucher' },
    ],
    grantVoucherId: 'cotton-on-15-voucher',
    participantCount: 0,
    completedCount: 0,
    active: true,
  },
  'coffee-connoisseur-route': {
    merchantName: 'Coffee Connoisseur Route',
    description: 'Visit 5 different indie cafes: Ya Kun Kaya Toast, Killiney Kopitiam, Toast Box, Dough Culture, or Marina Bay Hawker.',
    progressUnitLabel: 'cafes',
    icon: 'cafe-outline',
    difficulty: 'hard',
    durationType: 'monthly',
    requirementType: 'visit_count_at_merchants',
    requirementTarget: 5,
    requirementMeta: {
      // Real merchants from data/pay-qr-merchants.json, chosen for their
      // casual local cafe/kopitiam flavor to match "indie cafe route".
      merchantIds: ['ya kun kaya toast', 'killiney kopitiam', 'toast box', 'dough culture', 'marina bay hawker'],
    },
    points: 40,
    rewards: [
      { label: "'Coffee Master' Title", style: 'badge' },
      { label: 'Coffee Bean Pet Theme', style: 'badge' },
      { label: 'Starbucks $5 Voucher', style: 'voucher' },
    ],
    grantVoucherId: 'starbucks-5-voucher',
    participantCount: 0,
    completedCount: 0,
    active: true,
  },

  // ---- Fixed / limited-time (2) — a countdown starts the moment a user taps "Start Challenge" ----
  'weekend-feast': {
    merchantName: 'Weekend Feast',
    description: 'Spend $30 at Din Tai Fung, Ichiban Sushi, or Pizza Hut. 5 days to complete once started.',
    icon: 'restaurant-outline',
    difficulty: 'average',
    durationType: 'fixed',
    durationDays: 5,
    requirementType: 'spend_amount_at_merchant',
    requirementTarget: 30,
    requirementMeta: {
      merchantIds: ['din tai fung', 'ichiban sushi', 'pizza hut'],
    },
    points: 12,
    rewards: [
      { label: 'Foodie Weekend Badge', style: 'badge' },
      { label: '[Buff] Well Fed (24h)', style: 'buff' },
    ],
    participantCount: 0,
    completedCount: 0,
    active: true,
  },
  'wellness-week': {
    merchantName: 'Wellness Week',
    description: 'Spend $20 at Guardian Pharmacy or Watsons. 14 days to complete once started.',
    icon: 'medkit-outline',
    difficulty: 'easy',
    durationType: 'fixed',
    durationDays: 14,
    requirementType: 'spend_amount_at_merchant',
    requirementTarget: 20,
    requirementMeta: {
      merchantIds: ['guardian pharmacy', 'watsons'],
    },
    points: 8,
    rewards: [
      { label: 'Wellness Warrior Badge', style: 'badge' },
      { label: 'Watsons $10 Voucher', style: 'voucher' },
    ],
    grantVoucherId: 'watsons-10-off',
    participantCount: 0,
    completedCount: 0,
    active: true,
  },

  // ---- Event / occasion-based (2) — tied to a calendar date, not to when the user starts ----
  'national-day-spender': {
    merchantName: 'National Day Spending Spree',
    description: 'Spend $88 at any merchant. Available 1–15 August only.',
    icon: 'flag-outline',
    difficulty: 'average',
    durationType: 'event',
    eventName: 'National Day',
    eventStartDate: '2026-08-01T00:00:00+08:00',
    eventEndDate: '2026-08-15T23:59:59+08:00',
    requirementType: 'spend_amount_at_merchant',
    requirementTarget: 88,
    requirementMeta: { merchantIds: ['any'] }, // 'any' matches every merchant — intentional for a store-wide event
    points: 40,
    rewards: [{ label: "'SG Patriot' Badge", style: 'badge' }],
    participantCount: 0,
    completedCount: 0,
    active: true,
  },
  'travel-deals-week': {
    merchantName: 'Travel Deals Week',
    description: 'Spend $100 at Scoot, AirAsia, Agoda, Booking.com, or Klook. Available until 15 December.',
    icon: 'airplane-outline',
    difficulty: 'hard',
    durationType: 'event',
    eventName: 'Travel Deals Week',
    eventEndDate: '2026-12-15T23:59:59+08:00',
    requirementType: 'spend_amount_at_merchant',
    requirementTarget: 100,
    requirementMeta: {
      merchantIds: ['scoot', 'airasia', 'agoda', 'booking.com', 'klook'],
    },
    points: 50,
    rewards: [
      { label: "'Globetrotter' Title", style: 'badge' },
      { label: 'Klook $20 Voucher', style: 'voucher' },
    ],
    grantVoucherId: 'klook-travel-deal',
    participantCount: 0,
    completedCount: 0,
    active: true,
  },
};

module.exports = {
  dailyQuestTemplates,
  weeklyQuestTemplates,
  partnerChallenges,
};
