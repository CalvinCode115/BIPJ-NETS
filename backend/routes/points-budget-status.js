const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const { getFirestore } = require('../firebase/admin');
const { getTodaysPointsBudget } = require('../services/points-budget');

const router = express.Router();

/**
 * Tells the frontend whether today's earning caps have been hit — used to
 * show a "you've reached today's point limit" toast on the NETS Points
 * page. Read-only, reuses the exact same getTodaysPointsBudget() that
 * transaction-rewards.js and quests.js already use to actually enforce
 * the caps — this route just exposes it for display purposes.
 */
router.get('/users/:userId/points/budget-status', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const firestoreDb = getFirestore();
  const { pointsRemaining, transactionCapReached } = await getTodaysPointsBudget(firestoreDb, req.params.userId);

  res.json({
    pointsRemaining,
    transactionCapReached,
    pointsCapped: pointsRemaining <= 0,
  });
}));

module.exports = router;
