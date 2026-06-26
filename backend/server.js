const express = require('express');
const cors = require('cors');
const db = require('./db');
const seedData = require('./seed-data');
const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');

db.initialize();

if (db.isEmpty()) {
  db.seed(seedData, { mode: 'reset' });
  console.log('Initialized SQLite with seed accounts (Alex, Sarah, Cheng).');
} else {
  console.log('SQLite ready — runtime data preserved (no auto-reseed on startup).');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`NETS backend running at http://localhost:${PORT}/api`);
});
