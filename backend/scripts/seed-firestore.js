#!/usr/bin/env node
const path = require('path');
const { resolveServiceAccountPath } = require('../firebase/admin');
const seedData = require('../seed-data');
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

  const result = await seedFirestore(seedData, { reset });
  const mode = reset ? 'reset' : 'merge';

  console.log(`Firestore seed (${mode}) complete.`);
  console.log(`  users: ${result.users}`);
  console.log(`  cards: ${result.cards}`);
  console.log(`  transactions: ${result.transactions}`);
  console.log(`  seed_version: ${result.seedVersion}`);
  console.log('');
  console.log('Collections: users/{userId}/cards|transactions|notifications|rewards|payogotchi|travel');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
