const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const myVouchers = require('../services/my-vouchers');

const router = express.Router();

router.get('/users/:userId/vouchers', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await myVouchers.getUserVouchers(req.params.userId);
  res.json(result);
}));

/**
 * ⚠️ TEST/DEV ONLY — see the comment above markVoucherUsed() in
 * services/my-vouchers.js. Body: { merchant?, location? }
 */
router.post('/users/:userId/vouchers/:voucherInstanceId/mark-used', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { merchant, location } = req.body;
  const result = await myVouchers.markVoucherUsed(req.params.userId, req.params.voucherInstanceId, {
    merchant,
    location,
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true });
}));

module.exports = router;
