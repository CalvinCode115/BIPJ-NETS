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
 * category: one of 'Retail' | 'Dining' | 'Transport' | 'Groceries' | 'Travel'
 *   — used ONLY for the Marketplace page's category filter. Coffee/Drinks
 *   merchants are tagged 'Dining' here, matching how Diverse Spender
 *   collapses those categories too.
 *
 * discountType / discountValue / discountCap: how much this voucher
 * actually discounts a payment by (separate from pointsCost, which is what
 * it costs to redeem).
 *
 * validityDays: how many days after REDEMPTION the voucher stays usable
 * before moving from Available -> Expired in My Vouchers.
 */

const voucherCatalog = {
  'liho-1-dollar-voucher': {
    merchantName: 'LiHO Tea',
    description: '$1 Voucher',
    icon: 'cup-outline',
    logoUrl: 'assets/merchant-logos/liho.jpg', // put your actual logo file at src/assets/merchant-logos/liho.png
    category: 'Dining',
    pointsCost: 40,
    type: 'permanent',
    difficulty: 'easy',
    merchantIds: ['liho tea'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 30,
    discountType: 'flat',
    discountValue: 1,
    discountCap: null,
    minSpend: null,
    termsAndConditions: [
      '$1 off any LiHO Tea purchase.',
      'One redemption per transaction.',
      'Cannot be combined with other LiHO Tea promotions.',
      'Valid for 30 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay a LiHO Tea outlet via NETS QR.',
    ],
    active: true,
  },
  'grab-3-ride-voucher': {
    merchantName: 'Grab',
    description: '$3 Ride Voucher',
    icon: 'car-outline',
    logoUrl: 'assets/merchant-logos/grab.png', // put your actual logo file at src/assets/merchant-logos/grab.png
    category: 'Transport',
    pointsCost: 180,
    type: 'permanent',
    difficulty: 'easy',
    merchantIds: ['grab'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 90,
    discountType: 'flat',
    discountValue: 3,
    discountCap: null,
    minSpend: null,
    termsAndConditions: [
      '$3 off one Grab ride paid via NETS.',
      'Valid for GrabCar and GrabFood; not valid for GrabPay top-ups.',
      'One voucher per ride.',
      'Valid for 90 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay Grab via NETS QR.',
    ],
    active: true,
  },
  'starbucks-5-voucher': {
    merchantName: 'Starbucks',
    description: '$5 Beverage Voucher',
    icon: 'cafe-outline',
    logoUrl: 'assets/merchant-logos/starbucks.png', // put your actual logo file at src/assets/merchant-logos/starbucks.png
    category: 'Dining',
    pointsCost: 240,
    type: 'permanent',
    difficulty: 'easy',
    merchantIds: ['starbucks raffles place', 'starbucks one raffles'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 30,
    discountType: 'flat',
    discountValue: 5,
    discountCap: null,
    minSpend: null,
    termsAndConditions: [
      '$5 off any beverage at participating Starbucks outlets.',
      'Valid for one transaction only.',
      'Not valid with other Starbucks promotions or discounts.',
      'Valid for 30 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay a participating Starbucks via NETS QR.',
    ],
    active: true,
  },
  'boost-juice-5-voucher': {
    merchantName: 'Boost Juice',
    description: '$5 Voucher',
    icon: 'nutrition-outline',
    logoUrl: 'assets/merchant-logos/boost-juice.png', // put your actual logo file at src/assets/merchant-logos/boost-juice.png
    category: 'Dining',
    pointsCost: 360,
    type: 'limited',
    difficulty: 'moderate',
    merchantIds: ['boost juice'],
    quantityLimitType: 'daily',
    quantityLimitAmount: 100,
    validityDays: 30,
    discountType: 'flat',
    discountValue: 5,
    discountCap: null,
    minSpend: null,
    termsAndConditions: [
      '$5 off any Boost Juice drink.',
      'Limited to 100 redemptions per day, first come first served.',
      'One voucher per transaction.',
      'Valid for 30 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay Boost Juice via NETS QR.',
    ],
    active: true,
  },
  'watsons-10-off': {
    merchantName: 'Watsons',
    description: '$10 Off Voucher',
    icon: 'medkit-outline',
    logoUrl: 'assets/merchant-logos/watsons.png', // put your actual logo file at src/assets/merchant-logos/watsons.png
    category: 'Retail',
    pointsCost: 520,
    type: 'permanent',
    difficulty: 'moderate',
    merchantIds: ['watsons'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 45,
    discountType: 'flat',
    discountValue: 10,
    discountCap: null,
    minSpend: 15,
    termsAndConditions: [
      '$10 off min. spend $15 at Watsons.',
      'Valid on regular-priced items only.',
      'One voucher per transaction.',
      'Valid for 45 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay Watsons via NETS QR.',
    ],
    active: true,
  },
  'starbucks-10-voucher': {
    merchantName: 'Starbucks',
    description: '$10 Beverage Voucher',
    icon: 'cafe-outline',
    logoUrl: 'assets/merchant-logos/starbucks.png', // put your actual logo file at src/assets/merchant-logos/starbucks.png
    category: 'Dining',
    pointsCost: 560,
    type: 'permanent',
    difficulty: 'moderate',
    merchantIds: ['starbucks raffles place', 'starbucks one raffles'],
    quantityLimitType: 'none',
    quantityLimitAmount: null,
    validityDays: 30,
    discountType: 'flat',
    discountValue: 10,
    discountCap: null,
    minSpend: null,
    termsAndConditions: [
      '$10 off any purchase at participating Starbucks outlets.',
      'Valid for one transaction only.',
      'Not valid with other Starbucks promotions or discounts.',
      'Valid for 30 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay a participating Starbucks via NETS QR.',
    ],
    active: true,
  },
  'decathlon-10-off': {
    merchantName: 'Decathlon',
    description: '$10 Off Voucher',
    icon: 'basketball-outline',
    logoUrl: 'assets/merchant-logos/decathlon.png', // put your actual logo file at src/assets/merchant-logos/decathlon.png
    category: 'Retail',
    pointsCost: 1200,
    type: 'limited',
    difficulty: 'challenging',
    merchantIds: ['decathlon singapore'],
    quantityLimitType: 'weekly',
    quantityLimitAmount: 30,
    validityDays: 45,
    discountType: 'flat',
    discountValue: 10,
    discountCap: null,
    minSpend: 40,
    termsAndConditions: [
      '$10 off min. spend $40 at Decathlon Singapore.',
      'Limited to 30 redemptions per week, first come first served.',
      'One voucher per transaction.',
      'Valid for 45 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay Decathlon via NETS QR.',
    ],
    active: true,
  },
  'national-day-fnb-discount': {
    merchantName: 'National Day 50% F&B Discount',
    description: '50% off, up to $5 off',
    icon: 'flag-outline',
    logoUrl: 'assets/merchant-logos/national-day.jpg', // put your actual logo file at src/assets/merchant-logos/national-day.png
    category: 'Dining',
    pointsCost: 1300,
    type: 'event',
    difficulty: 'challenging',
    // Category-based rather than merchant-based — matches any Dining,
    // Coffee, or Drinks transaction during the event window.
    merchantIds: ['any'],
    eligibleCategories: ['Dining', 'Coffee', 'Drinks'],
    eventStartDate: '2026-08-01T00:00:00+08:00',
    eventEndDate: '2026-08-15T23:59:59+08:00',
    quantityLimitType: 'daily',
    quantityLimitAmount: 100,
    validityDays: 14,
    discountType: 'percentage',
    discountValue: 50,
    discountCap: 5,
    minSpend: null,
    termsAndConditions: [
      '50% off one F&B transaction, capped at $5 off.',
      'Valid 1–15 August 2026 only, at any Dining, Coffee, or Drinks merchant.',
      'Limited to 100 redemptions per day during the event.',
      'Valid for 14 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay a participating F&B merchant via NETS QR, during the event window.',
    ],
    active: true,
  },
  'cotton-on-15-voucher': {
    merchantName: 'Cotton On',
    description: '$15 Fashion Voucher',
    icon: 'shirt-outline',
    logoUrl: 'assets/merchant-logos/cotton-on.png', // put your actual logo file at src/assets/merchant-logos/cotton-on.png
    category: 'Retail',
    pointsCost: 1400,
    type: 'limited',
    difficulty: 'challenging',
    merchantIds: ['cotton on'],
    quantityLimitType: 'weekly',
    quantityLimitAmount: 50,
    validityDays: 45,
    discountType: 'flat',
    discountValue: 15,
    discountCap: null,
    minSpend: 25,
    termsAndConditions: [
      '$15 off min. spend $25 at Cotton On.',
      'Limited to 50 redemptions per week, first come first served.',
      'One voucher per transaction.',
      'Valid for 45 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay Cotton On via NETS QR.',
    ],
    active: true,
  },
  'klook-travel-deal': {
    merchantName: 'Klook',
    description: '$20 Year-End Travel Deal',
    icon: 'airplane-outline',
    logoUrl: 'assets/merchant-logos/klook.png', // put your actual logo file at src/assets/merchant-logos/klook.png
    category: 'Travel',
    pointsCost: 2500,
    type: 'event',
    difficulty: 'premium',
    merchantIds: ['klook'],
    eventStartDate: '2026-11-01T00:00:00+08:00',
    eventEndDate: '2026-12-20T23:59:59+08:00',
    quantityLimitType: 'total',
    quantityLimitAmount: 200,
    redeemedCount: 0, // tracks the fixed pool directly (never resets), unlike daily/weekly counters
    validityDays: 7,
    discountType: 'flat',
    discountValue: 20,
    discountCap: null,
    minSpend: 80,
    termsAndConditions: [
      '$20 off min. spend $80 on Klook, valid 1 Nov – 20 Dec 2026.',
      'Limited to 200 redemptions for the entire event — while stocks last.',
      'One voucher per booking.',
      'Valid for 7 days from the date of redemption.',
    ],
    usageSteps: [
      'This voucher applies automatically the next time you pay Klook via NETS QR, during the event window.',
    ],
    active: true,
  },
};

module.exports = { voucherCatalog };
