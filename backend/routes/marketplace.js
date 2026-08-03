const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const marketplace = require('../services/marketplace');

const router = express.Router();

// Vouchers are the same for every user, so no userId needed to list them —
// but redemption is obviously per-user.
router.get('/marketplace/vouchers', asyncHandler(async (req, res) => {
  const result = await marketplace.getMarketplaceVouchers();
  res.json(result);
}));

router.post('/users/:userId/marketplace/vouchers/:voucherId/redeem', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await marketplace.redeemVoucher(req.params.userId, req.params.voucherId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ success: true, voucherInstanceId: result.voucherInstanceId, pointsSpent: result.pointsSpent });
}));

module.exports = router;
