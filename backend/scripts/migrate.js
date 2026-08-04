#!/usr/bin/env node
const { getDb, closeDb } = require('../db/sqlite');

getDb();
console.log('SQLite migrations applied.');
console.log(`Database: ${require('../db/sqlite').getDbPath()}`);
closeDb();
