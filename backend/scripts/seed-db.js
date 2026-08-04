#!/usr/bin/env node
const db = require('../db');
const seedData = require('../seed-data');

const reset = process.argv.includes('--reset');

async function main() {
  await db.initialize();

  if (reset) {
    await db.seed(seedData, { mode: 'reset' });
    console.log('Firestore reset with seed accounts and sample history.');
  } else if (await db.isEmpty()) {
    await db.seed(seedData, { mode: 'reset' });
    console.log('Empty Firestore — loaded seed accounts (Alex, Sarah, Cheng, Adam).');
  } else {
    await db.seed(seedData, { mode: 'merge' });
    console.log('Seed accounts merged (existing users and transactions kept).');
  }

  console.log('Accounts: Alex 91234567, Sarah 87654321, Cheng 80680505, Adam 84688831 (PIN 123456)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
