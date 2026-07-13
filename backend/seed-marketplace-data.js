/**
 * Seed data for the Rewards Marketplace. Merged into Firestore by
 * scripts/seed-firestore.js alongside the quest/challenge seed data.
 *
 * quantityLimitType:
 *   'none'   — unlimited (typical for 'permanent' vouchers)
 *   'daily'  — resets every day at 00:00 SGT (e.g. "100 available today")
 *   'weekly' — resets every Monday 00:00 SGT
 *   'total'  — a single fixed pool that never resets (typical for a one-off event item)
 *
 * validityDays: how many days after REDEMPTION the voucher stays usable
 * before moving from Available -> Expired in My Vouchers.
 */

const voucherCatalog = {
  'liho-topping-upgrade': {
    merchantName: 'LiHO Tea',
    description: 'Free Topping Upgrade',
    icon: 'cup-outline',
    pointsCost: 600,
    minSpend: null, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'none', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 0, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'permanent',
    difficulty: 'easy',
    merchantIds: ['liho tea'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 90,
    termsAndConditions: [
      'Valid for one free topping upgrade on any LiHO Tea drink.',
      'One redemption per transaction.',
      'Cannot be combined with other LiHO Tea promotions.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay a LiHO Tea outlet via NETS QR.',
    ],
    active: true,
  },
  'grab-3-ride-voucher': {
    merchantName: 'Grab',
    description: '$3 Ride Voucher',
    icon: 'car-outline',
    pointsCost: 900,
    minSpend: null, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 3, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'permanent',
    difficulty: 'easy',
    merchantIds: ['grab'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 90,
    termsAndConditions: [
      '$3 off one Grab ride paid via NETS.',
      'Valid for GrabCar and GrabFood; not valid for GrabPay top-ups.',
      'One voucher per ride.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay Grab via NETS QR.',
    ],
    active: true,
  },
  'starbucks-5-voucher': {
    merchantName: 'Starbucks',
    description: '$5 Beverage Voucher',
    icon: 'cafe-outline',
    pointsCost: 1200,
    minSpend: null, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 5, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'permanent',
    difficulty: 'easy',
    merchantIds: ['starbucks raffles place', 'starbucks one raffles'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 90,
    termsAndConditions: [
      '$5 off any beverage at participating Starbucks outlets.',
      'Valid for one transaction only.',
      'Not valid with other Starbucks promotions or discounts.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay a participating Starbucks via NETS QR.',
    ],
    active: true,
  },
  'boost-juice-5-voucher': {
    merchantName: 'Boost Juice',
    description: '$5 Voucher',
    icon: 'nutrition-outline',
    pointsCost: 1800,
    minSpend: null, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 5, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'limited',
    difficulty: 'moderate',
    merchantIds: ['boost juice'],
    quantityLimitType: 'daily',
    quantityLimitAmount: 100,
    validityDays: 90,
    termsAndConditions: [
      '$5 off any Boost Juice drink.',
      'Limited to 100 redemptions per day, first come first served.',
      'One voucher per transaction.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay Boost Juice via NETS QR.',
    ],
    active: true,
  },
  'watsons-10-off': {
    merchantName: 'Watsons',
    description: '$10 Off Voucher',
    icon: 'medkit-outline',
    pointsCost: 2600,
    minSpend: 30, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 10, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'permanent',
    difficulty: 'moderate',
    merchantIds: ['watsons'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 90,
    termsAndConditions: [
      '$10 off min. spend $30 at Watsons.',
      'Valid on regular-priced items only.',
      'One voucher per transaction.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay Watsons via NETS QR.',
    ],
    active: true,
  },
  'starbucks-10-voucher': {
    merchantName: 'Starbucks',
    description: '$10 Beverage Voucher',
    icon: 'cafe-outline',
    pointsCost: 2800,
    minSpend: null, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 10, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'permanent',
    difficulty: 'moderate',
    merchantIds: ['starbucks raffles place', 'starbucks one raffles'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 90,
    termsAndConditions: [
      '$10 off any purchase at participating Starbucks outlets.',
      'Valid for one transaction only.',
      'Not valid with other Starbucks promotions or discounts.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay a participating Starbucks via NETS QR.',
    ],
    active: true,
  },
  'decathlon-10-off': {
    merchantName: 'Decathlon',
    description: '$10 Off Voucher',
    icon: 'basketball-outline',
    pointsCost: 6000,
    minSpend: 40, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 10, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'limited',
    difficulty: 'challenging',
    merchantIds: ['decathlon singapore'],
    quantityLimitType: 'weekly',
    quantityLimitAmount: 30,
    validityDays: 90,
    termsAndConditions: [
      '$10 off min. spend $40 at Decathlon Singapore.',
      'Limited to 30 redemptions per week, first come first served.',
      'One voucher per transaction.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay Decathlon via NETS QR.',
    ],
    active: true,
  },
  'national-day-fnb-discount': {
    merchantName: 'National Day 50% F&B Discount',
    description: '50% off, up to $5 off',
    icon: 'flag-outline',
    pointsCost: 6500,
    minSpend: null, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'percentage', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 50, // dollars for 'flat', percent for 'percentage'
    discountCap: 5, // only used for 'percentage' — max $ off
    type: 'event',
    difficulty: 'challenging',
    // Category-based rather than merchant-based — matches any Dining,
    // Coffee, or Drinks transaction during the event window.
    merchantIds: ['any'],
    eligibleCategories: ['Dining', 'Coffee', 'Drinks'],
    eventStartDate: '2026-08-01T00:00:00+08:00',
    eventEndDate: '2026-08-09T23:59:59+08:00',
    quantityLimitType: 'daily',
    quantityLimitAmount: 100,
    validityDays: 14,
    termsAndConditions: [
      '50% off one F&B transaction, capped at $5 off.',
      'Valid 1–9 August 2026 only, at any Dining, Coffee, or Drinks merchant.',
      'Limited to 100 redemptions per day during the event.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay a participating F&B merchant via NETS QR, during the event window.',
    ],
    active: true,
  },
  'cotton-on-15-voucher': {
    merchantName: 'Cotton On',
    description: '$15 Fashion Voucher',
    icon: 'shirt-outline',
    pointsCost: 7000,
    minSpend: 50, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 15, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'limited',
    difficulty: 'challenging',
    merchantIds: ['cotton on'],
    quantityLimitType: 'weekly',
    quantityLimitAmount: 50,
    validityDays: 90,
    termsAndConditions: [
      '$15 off min. spend $50 at Cotton On.',
      'Limited to 50 redemptions per week, first come first served.',
      'One voucher per transaction.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay Cotton On via NETS QR.',
    ],
    active: true,
  },
  'klook-travel-deal': {
    merchantName: 'Klook',
    description: '$20 Year-End Travel Deal',
    icon: 'airplane-outline',
    pointsCost: 12500,
    minSpend: 80, // structured, for programmatic eligibility checks (vs the free-text T&Cs)
    discountType: 'flat', // 'flat' ($ off) | 'percentage' (% off) | 'none' (non-cash perk)
    discountValue: 20, // dollars for 'flat', percent for 'percentage'
    discountCap: null, // only used for 'percentage' — max $ off
    type: 'event',
    difficulty: 'premium',
    merchantIds: ['klook'],
    eventStartDate: '2026-11-01T00:00:00+08:00',
    eventEndDate: '2026-12-20T23:59:59+08:00',
    quantityLimitType: 'total',
    quantityLimitAmount: 200,
    redeemedCount: 0, // tracks the fixed pool directly (never resets), unlike daily/weekly counters
    validityDays: 30,
    termsAndConditions: [
      '$20 off min. spend $80 on Klook, valid 1 Nov – 20 Dec 2026.',
      'Limited to 200 redemptions for the entire event — while stocks last.',
      'One voucher per booking.',
    ],
    usageSteps: [
      'Open My Vouchers and tap this voucher.',
      'This voucher applies automatically the next time you pay Klook via NETS QR, during the event window.',
    ],
    active: true,
  },
};

module.exports = { voucherCatalog };
