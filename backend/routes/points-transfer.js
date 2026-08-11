const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const pointsTransfer = require('../services/points-transfer');

const router = express.Router();

/**
 * Looks up a payee by phone number as the user types it in, so the Send
 * Points page can show their name (or "Payee not found") before sending.
 */
router.get('/users/lookup-by-phone/:phone', asyncHandler(async (req, res) => {
  const result = await pointsTransfer.lookupUserByPhone(req.params.phone);
  res.json(result);
}));

router.post('/users/:userId/points/send', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { toPhone, amount, comment, allowPartial } = req.body;
  if (!toPhone || amount === undefined) {
    return res.status(400).json({ error: 'toPhone and amount are required.' });
  }

  const result = await pointsTransfer.sendPoints(req.params.userId, {
    toPhone,
    amount,
    comment,
    allowPartial: !!allowPartial,
  });

  if (!result.ok) {
    return res.status(400).json({
      error: result.error,
      wouldExceedCap: result.wouldExceedCap ?? false,
      maxSendable: result.maxSendable ?? null,
    });
  }

  res.json({
    success: true,
    toName: result.toName,
    amount: result.amount,
    wasCapped: result.wasCapped ?? false,
  });
}));

module.exports = router;
