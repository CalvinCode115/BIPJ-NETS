const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'wallet.db');
const migrationsDir = path.join(__dirname, 'migrations');

let dbInstance = null;

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function listMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    database.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name)
  );

  for (const fileName of listMigrationFiles()) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
    database.exec(sql);
    database.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(fileName);
  }
}

function getDb() {
  if (!dbInstance) {
    ensureDataDir();
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    runMigrations(dbInstance);
  }

  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function getDbPath() {
  return dbPath;
}

module.exports = {
  getDb,
  closeDb,
  getDbPath,
  runMigrations,
  ensureDataDir,
};
