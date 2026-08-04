const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const dailyCheckin = require('../services/daily-checkin');

const router = express.Router();

router.get('/users/:userId/checkin/status', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await dailyCheckin.getCheckinStatus(req.params.userId);
  res.json(result);
}));

router.post('/users/:userId/checkin', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await dailyCheckin.checkIn(req.params.userId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, day: result.day, reward: result.reward });
}));

module.exports = router;
