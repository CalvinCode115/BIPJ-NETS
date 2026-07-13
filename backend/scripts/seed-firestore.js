#!/usr/bin/env node
const path = require('path');
const { resolveServiceAccountPath } = require('../firebase/admin');
const seedData = require('../seed-data');
const questsSeedData = require('../seed-quests-data');
const { voucherCatalog } = require('../seed-marketplace-data');
const { seedFirestore } = require('../db/firestore-seed');

const reset = process.argv.includes('--reset');

async function main() {
  const keyPath = resolveServiceAccountPath();
  if (!keyPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('');
    console.error('Firebase service account not found.');
    console.error('');
    console.error('1. Firebase Console → Project settings → Service accounts');
    console.error('2. Generate new private key → save as:');
    console.error('   backend/firebase/service-account.json');
    console.error('');
    console.error('Or set FIREBASE_SERVICE_ACCOUNT to the JSON file path.');
    console.error('');
    process.exit(1);
  }

  if (keyPath) {
    console.log(`Using service account: ${path.relative(process.cwd(), keyPath)}`);
  } else {
    console.log('Using GOOGLE_APPLICATION_CREDENTIALS');
  }

  const result = await seedFirestore(
    {
      ...seedData,
      dailyQuestTemplates: questsSeedData.dailyQuestTemplates,
      weeklyQuestTemplates: questsSeedData.weeklyQuestTemplates,
      partnerChallenges: questsSeedData.partnerChallenges,
      voucherCatalog,
    },
    { reset }
  );
  const mode = reset ? 'reset' : 'merge';

  console.log(`Firestore seed (${mode}) complete.`);
  console.log(`  users: ${result.users}`);
  console.log(`  cards: ${result.cards}`);
  console.log(`  transactions: ${result.transactions}`);
  console.log(`  daily quest templates: ${result.dailyQuestTemplates}`);
  console.log(`  weekly quest templates: ${result.weeklyQuestTemplates}`);
  console.log(`  partner challenges: ${result.partnerChallenges}`);
  console.log(`  marketplace vouchers: ${result.voucherCatalog}`);
  console.log(`  seed_version: ${result.seedVersion}`);
  console.log('');
  console.log(
    'Collections: users/{userId}/cards|transactions|notifications|rewards|payogotchi|travel|dailyQuestProgress|weeklyQuestProgress|challengeProgress|vouchers'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
