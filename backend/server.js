const express = require('express');
const cors = require('cors');
const db = require('./db');
const seedData = require('./seed-data');
const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Cheap, dependency-free liveness probe — used to warm Render's free tier
// before a demo, and as the platform health check.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await db.initialize();

  if (await db.isEmpty()) {
    await db.seed(seedData, { mode: 'reset' });
    console.log('Initialized Firestore with seed accounts (Alex, Sarah, Cheng).');
  } else {
    console.log('Firestore ready — runtime data preserved (no auto-reseed on startup).');
  }

  app.listen(PORT, () => {
    console.log(`NETS backend running at http://localhost:${PORT}/api`);
  });
}

start().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
