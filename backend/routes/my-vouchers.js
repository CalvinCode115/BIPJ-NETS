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
 * Called by the Pay/QR flow after scanning a merchant QR and knowing the
 * amount, but BEFORE the payment is confirmed. Body: { merchant, category, amount }
 */
router.post('/users/:userId/vouchers/check-eligibility', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { merchant, category, amount } = req.body;
  if (!merchant || amount === undefined) {
    return res.status(400).json({ error: 'merchant and amount are required.' });
  }

  const result = await myVouchers.checkEligibleVouchers(req.params.userId, { merchant, category, amount });
  res.json(result);
}));

/**
 * Applies a voucher to a payment. Call this after the user confirms "yes,
 * use this voucher" in the pre-payment popup. Body: { merchant?, location? }
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
