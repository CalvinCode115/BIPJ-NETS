#!/usr/bin/env node
const db = require('../db');
const seedData = require('../seed-data');
const { closeDb } = require('../db/sqlite');

const reset = process.argv.includes('--reset');

db.initialize();

if (reset) {
  db.seed(seedData, { mode: 'reset' });
  console.log('Database reset with seed accounts and sample history.');
} else if (db.isEmpty()) {
  db.seed(seedData, { mode: 'reset' });
  console.log('Empty database — loaded seed accounts (Alex, Sarah, Cheng, Adam).');
} else {
  db.seed(seedData, { mode: 'merge' });
  console.log('Seed accounts merged (existing users and transactions kept).');
}

console.log('Accounts: Alex 91234567, Sarah 87654321, Cheng 80680505, Adam 84688831 (PIN 123456)');
closeDb();
