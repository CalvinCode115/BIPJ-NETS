const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const quests = require('../services/quests');

const router = express.Router();

router.get('/users/:userId/badges', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.getBadgesForUser(req.params.userId);
  res.json(result);
}));

module.exports = router;
