const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const quests = require('../services/quests');

const router = express.Router();

router.get('/users/:userId/quests/daily', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.getDailyQuestsForUser(req.params.userId);
  res.json(result);
}));

router.post('/users/:userId/quests/daily/:templateId/claim', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.claimDailyQuestReward(req.params.userId, req.params.templateId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, pointsAwarded: result.pointsAwarded });
}));

router.get('/users/:userId/quests/weekly', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.getWeeklyQuestsForUser(req.params.userId);
  res.json(result);
}));

router.post('/users/:userId/quests/weekly/:templateId/claim', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.claimWeeklyQuestReward(req.params.userId, req.params.templateId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, pointsAwarded: result.pointsAwarded });
}));

router.get('/users/:userId/challenges', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.getPartnerChallengesForUser(req.params.userId);
  res.json(result);
}));

router.post('/users/:userId/challenges/:challengeId/start', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.startChallenge(req.params.userId, req.params.challengeId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, alreadyStarted: result.alreadyStarted });
}));

router.post('/users/:userId/challenges/:challengeId/claim', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await quests.claimChallengeReward(req.params.userId, req.params.challengeId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, pointsAwarded: result.pointsAwarded });
}));

/**
 * The single hook other parts of the app (Pay, Travel, etc.) should call
 * right after a real user action completes, so quest/challenge progress
 * stays in sync.
 *
 * body: { eventType: 'transaction' | 'merchant_visit' | 'bill_split',
 *         amount?, merchantId?, merchantCategory?, isNewMerchant? }
 */
router.post('/users/:userId/quests/events', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { eventType } = req.body;
  if (!eventType) {
    return res.status(400).json({ error: 'eventType is required.' });
  }

  const result = await quests.recordQuestEvent(req.params.userId, req.body);
  res.json({ success: true, pointsAwarded: result.pointsAwarded });
}));

module.exports = router;
