const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const points = require('../services/points');

const router = express.Router();

router.get('/users/:userId/points/balance', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await points.getPointsBalance(req.params.userId);
  res.json(result);
}));

/**
 * Query params (all optional):
 *   search    - text search against transaction titles
 *   startDate - 'YYYY-MM-DD'
 *   endDate   - 'YYYY-MM-DD'
 *   limit     - max entries to return
 */
router.get('/users/:userId/points/history', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { search, startDate, endDate, limit } = req.query;
  const entries = await points.getPointsHistory(req.params.userId, {
    search: search || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
  });

  res.json({ entries });
}));

module.exports = router;
