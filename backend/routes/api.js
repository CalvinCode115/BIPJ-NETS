const express = require('express');
const db = require('../db');
const asyncHandler = require('../utils/async-handler');
const authRouter = require('./auth');
const questsRouter = require('./quests'); 
const pointsRouter = require('./points');

const {
  buildDnaProfile,
  buildDashboard,
  buildTransactionSummary,
  buildReport,
  buildInsights,
  createTransactionFromReceipt,
  formatTransaction,
} = require('../services/dna');
const netsSimulator = require('../services/nets-simulator');
const receiptSimulator = require('../services/receipt-simulator');
const qrPayment = require('../services/qr-payment');
const period = require('../services/period');
const cardUtils = require('../services/card-utils');
const spendingRules = require('../services/spending-rules');
const p2pTransfer = require('../services/p2p-transfer');
const nameMask = require('../services/name-mask');
const notificationService = require('../services/notifications');
const {
  LOW_BALANCE_THRESHOLD,
  MIN_TOP_UP_AMOUNT,
  MAX_TOP_UP_AMOUNT,
  MAX_WALLET_BALANCE,
  SOURCE_CARD_RESERVE,
} = require('../services/wallet-config');
const { clampCreditLimit } = require('../services/credit-config');
const { formatBalanceLeft } = require('../services/balance-message');
const transactionRewards = require('../services/transaction-rewards');
const payogotchiRewards = require('../services/payogotchi-rewards');
const marketplaceRouter = require('./marketplace');
const myVouchersRouter = require('./my-vouchers');
const myVouchers = require('../services/my-vouchers');
const pointsTransferRouter = require('./points-transfer')
const dailyCheckinRouter = require('./daily-checkin');
const badgesRouter = require('./badges');



const router = express.Router();

router.use('/auth', authRouter);
router.use('/', questsRouter);
router.use('/', pointsRouter);
router.use('/', marketplaceRouter);
router.use('/', myVouchersRouter);
router.use('/', pointsTransferRouter);
router.use('/', dailyCheckinRouter);
router.use('/', badgesRouter);

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'nets-backend', mode: 'firestore' });
});

/** Demo registry — cards known to the simulated NETS system */
router.get('/nets-simulator/registry', (_req, res) => {
  res.json({
    description:
      'Optional demo card numbers for quick testing. Any unused 16-digit number can be linked; balance is simulated from the digits.',
    cards: netsSimulator.REGISTRY.map(netsSimulator.formatRegistryEntry),
  });
});

/** Receipt catalog for Home (scan receipt flow) */
function listHomeReceipts(_req, res) {
  res.json({
    description: 'Receipt images for scanning from Home / gallery (src/assets/demo-receipts).',
    receipts: receiptSimulator.RECEIPT_CATALOG.map(receiptSimulator.formatReceipt),
  });
}

router.get('/home/receipts', listHomeReceipts);
router.get('/receipts/demo', listHomeReceipts);

function listPayQrMerchantsFull(_req, res) {
  const fs = require('fs');
  const { PAY_QR_MERCHANTS } = require('../data/catalog-paths');
  if (!fs.existsSync(PAY_QR_MERCHANTS)) {
    return res.json({ description: 'Run npm run generate:assets', merchants: [] });
  }
  const data = JSON.parse(fs.readFileSync(PAY_QR_MERCHANTS, 'utf8'));
  res.json({
    description: 'Merchant pay QR codes (src/assets/demo-qr). Scan via Pay → QR Code.',
    merchants: data.merchants || [],
  });
}

router.get('/pay/qr-merchants', listPayQrMerchantsFull);
router.get('/payments/qr/demo-assets', listPayQrMerchantsFull);

router.post('/receipts/scan', (req, res) => {
  const result = receiptSimulator.resolveScan(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    source: result.source,
    message: result.message,
    receipt: result.receipt,
  });
});

router.post('/users/:userId/transactions/receipt', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const receipt = req.body.receipt;
  if (!receipt?.merchant || !receipt?.amount) {
    return res.status(400).json({ error: 'Receipt details are required.' });
  }

  let card = null;
  if (receipt.cardNumber) {
    const digits = netsSimulator.normalizeDigits(receipt.cardNumber);
    card = await db.findLinkedCardByNumber(req.params.userId, digits);
    if (!card) {
      return res.status(400).json({
        error: 'This receipt was paid with a card that is not linked to your account.',
      });
    }
  } else {
    card = await db.resolveCardForPayment(req.params.userId, receipt.paymentMethod);
    if (!card) {
      return res.status(400).json({ error: 'No linked card found for this payment method.' });
    }
  }

  const saved = await db.addTransaction(createTransactionFromReceipt(req.params.userId, receipt, card));
  await transactionRewards.awardTransactionRewards(req.params.userId, saved);

  const refreshedCard = await db.setCardBalance(
    card.id,
    cardUtils.applyDebit(card, Math.abs(receipt.amount))
  );

  res.status(201).json({
    success: true,
    message: `Receipt added to your transactions. ${formatBalanceLeft(refreshedCard)}`,
    transaction: formatTransaction(saved),
    card: mapCard(refreshedCard, 'wallet'),
  });
}));

function listPayQrMerchantsSummary(_req, res) {
  res.json({
    description: 'Merchant QR codes for Pay tab scanning.',
    merchants: qrPayment.PAY_QR_CATALOG.map((merchant) => ({
      ...merchant,
      payload: qrPayment.buildPayPayload(merchant),
    })),
  });
}

router.get('/pay/qr-merchants/summary', listPayQrMerchantsSummary);
router.get('/payments/qr/demo', listPayQrMerchantsSummary);

router.post('/payments/qr/parse', asyncHandler(async (req, res) => {
  const result = qrPayment.parseQrPayload(req.body.payload);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  if (result.kind === 'receive') {
    const recipient = await db.getUser(result.receive.userId);
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient in this QR is not registered.' });
    }

    const receiveTarget = cardUtils.resolveReceiveCard(await db.getCards(recipient.id));
    return res.json({
      success: true,
      kind: 'receive',
      receive: {
        ...result.receive,
        name: recipient.name,
        phone: recipient.phone,
        receiveLabel: receiveTarget?.label ?? null,
        receiveMode: receiveTarget?.mode ?? null,
      },
    });
  }

  res.json({ success: true, kind: 'pay', payment: result.payment });
}));

router.get('/users/lookup', asyncHandler(async (req, res) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const user = await db.findUserByPhone(phone);
  if (!user) {
    return res.status(404).json({ error: 'No NETS user found for this mobile number.' });
  }

  const receiveTarget = cardUtils.resolveReceiveCard(await db.getCards(user.id));
  res.json({
    user: {
      id: user.id,
      name: user.name,
      maskedName: nameMask.maskDisplayName(user.name),
      phone: user.phone,
    },
    receiveLabel: receiveTarget?.label ?? null,
    receiveLabelShort: nameMask.shortReceiveLabel(receiveTarget?.label),
    receiveMode: receiveTarget?.mode ?? null,
  });
}));

router.get('/users/:userId/qr/receive', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const receiveTarget = cardUtils.resolveReceiveCard(await db.getCards(user.id));

  res.json({
    payload: qrPayment.buildReceivePayload(user),
    name: user.name,
    phone: user.phone,
    receiveLabel: receiveTarget?.label ?? null,
    receiveMode: receiveTarget?.mode ?? null,
  });
}));

router.post('/users/:userId/payments/qr', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const parsed = qrPayment.parseQrPayload(req.body.payload);
  if (!parsed.ok || parsed.kind !== 'pay' || !parsed.payment) {
    return res.status(400).json({ error: parsed.error || 'Invalid payment QR.' });
  }

  let card = null;
  if (req.body.cardId) {
    const payerCards = await db.getCards(req.params.userId);
    card = payerCards.find((row) => row.id === req.body.cardId) || null;
  } else if (req.body.cardNumber) {
    const digits = netsSimulator.normalizeDigits(req.body.cardNumber);
    card = await db.findLinkedCardByNumber(req.params.userId, digits);
  } else {
    card = await db.resolveCardForPayment(req.params.userId, 'NETS Prepaid');
  }

  if (!card) {
    return res.status(400).json({ error: 'No linked card found for this payment.' });
  }

  if (card.card_type === 'cashcard') {
    return res.status(400).json({
      error:
        'NETS CashCard cannot be used for QR payments. Switch to Prepaid or a linked card on Home.',
    });
  }

  const spendContext = spendingRules.classifySpendContext(
    parsed.payment.merchant,
    parsed.payment.category,
    parsed.payment.subtitle
  );

  if (!spendingRules.canSpendOnCard(card, spendContext)) {
    return res.status(400).json({ error: spendingRules.spendBlockMessage(card, spendContext) });
  }

  // ---- Optionally preview a voucher discount before charging — READ ONLY
  // at this point, nothing is written yet, so an insufficient-balance
  // failure below can never burn a voucher that was never actually used. ----
  let paymentToCharge = parsed.payment;
  let voucherApplied = false;
  let voucherDiscount = 0;
  let voucherError = null;

  if (req.body.voucherInstanceId) {
    const voucherPreview = await myVouchers.previewVoucherForPayment(
      req.params.userId,
      req.body.voucherInstanceId,
      {
        merchant: parsed.payment.merchant,
        category: parsed.payment.category,
        amount: parsed.payment.amount,
      }
    );

    if (voucherPreview.ok) {
      voucherApplied = true;
      voucherDiscount = voucherPreview.discountAmount;
      paymentToCharge = { ...parsed.payment, amount: voucherPreview.finalAmount };
    } else {
      // Don't fail the whole payment over a voucher issue — charge full
      // price and let the client know why the voucher didn't apply.
      voucherError = voucherPreview.error;
    }
  }
  // ---- end voucher preview ----

  if (!cardUtils.hasSufficientFunds(card, paymentToCharge.amount)) {
    return res.status(400).json({ error: 'Insufficient balance on the selected card.' });
  }

  const saved = await db.addTransaction(
    qrPayment.createTransactionFromQr(req.params.userId, paymentToCharge, card)
  );

  // Returns { pointsAwarded } so the client can tell the user what they
  // earned. Never throws — on failure it reports 0 and the payment stands.
  const rewards = await transactionRewards.awardTransactionRewards(req.params.userId, saved);

  const refreshedCard = await db.setCardBalance(card.id, cardUtils.applyDebit(card, paymentToCharge.amount));

  // ---- Only NOW actually commit the voucher as used — the payment has
  // definitely succeeded at this point (transaction saved, card debited). ----
  if (voucherApplied) {
    const commitResult = await myVouchers.commitVoucherUsage(req.params.userId, req.body.voucherInstanceId, {
      merchant: paymentToCharge.merchant,
    });
    if (!commitResult.ok) {
      // Extremely unlikely — would mean the voucher's state changed
      // between the preview above and now (e.g. a race with a second
      // concurrent request). The payment has already gone through at the
      // discounted price either way, so we don't undo it — just report
      // that the voucher itself didn't end up getting consumed.
      voucherApplied = false;
      voucherError = commitResult.error;
    }
  }

  const voucherNote = voucherApplied ? ` Voucher applied — you saved $${voucherDiscount.toFixed(2)}.` : '';

  res.status(201).json({
    success: true,
    message: `Paid $${paymentToCharge.amount.toFixed(2)} to ${paymentToCharge.merchant}.${voucherNote} ${formatBalanceLeft(refreshedCard)}`,
    payment: paymentToCharge,
    transaction: formatTransaction(saved),
    card: {
      id: refreshedCard.id,
      balance: refreshedCard.balance,
    },
    voucherApplied,
    voucherDiscount,
    voucherError,
    pointsAwarded: rewards.pointsAwarded ?? 0,
  });
}));

router.post('/users/:userId/transfers', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await p2pTransfer.executeTransfer(req.params.userId, {
    toUserId: req.body.toUserId,
    toPhone: req.body.toPhone,
    amount: req.body.amount,
    fromCardId: req.body.fromCardId,
    channel: req.body.channel || 'transfer',
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json({
    success: true,
    message: result.message,
    transferId: result.transferId,
    amount: result.amount,
    toUser: result.toUser,
    receiveLabel: result.receiveLabel,
    receiveMode: result.receiveMode,
    fromCard: mapCard(result.fromCard, 'wallet'),
    toCard: mapCard(result.toCard, 'wallet'),
    transaction: formatTransaction(result.senderTransaction),
  });
}));

router.post('/users/:userId/payments/qr/receive', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const parsed = qrPayment.parseQrPayload(req.body.payload);
  if (!parsed.ok || parsed.kind !== 'receive' || !parsed.receive?.userId) {
    return res.status(400).json({ error: parsed.error || 'Invalid receive QR.' });
  }

  const result = await p2pTransfer.executeTransfer(req.params.userId, {
    toUserId: parsed.receive.userId,
    amount: req.body.amount,
    fromCardId: req.body.fromCardId,
    channel: 'qr',
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.status(201).json({
    success: true,
    message: result.message,
    transferId: result.transferId,
    amount: result.amount,
    toUser: result.toUser,
    receiveLabel: result.receiveLabel,
    fromCard: mapCard(result.fromCard, 'wallet'),
    transaction: formatTransaction(result.senderTransaction),
  });
}));

router.get('/users/:userId/payable-cards', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cards = (await db.getCards(req.params.userId))
    .filter(cardUtils.canPayFrom)
    .map((row) => mapCard(row, 'wallet'));

  res.json({ cards });
}));

router.get('/users/:userId', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    tier: user.tier,
    points: user.points,
  });
}));

router.get('/users/:userId/cards', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cardType = req.query.type;
  if (cardType && !['prepaid', 'cashcard', 'others'].includes(cardType)) {
    return res.status(400).json({ error: 'Invalid card type. Use prepaid, cashcard, or others.' });
  }

  const view = req.query.view || 'summary';
  const cards = (await db.getCards(req.params.userId, cardType)).map((row) => mapCard(row, view));
  res.json({ cards });
}));

router.get('/users/:userId/cards/wallet', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cards = (await db.getCards(req.params.userId)).map((row) => mapCard(row, 'wallet'));
  res.json({ cardsByType: groupCardsByType(cards) });
}));

router.post('/users/:userId/cards/generate-number', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cardType = String(req.body?.cardType || '');
  if (cardType !== 'prepaid' && cardType !== 'cashcard') {
    return res.status(400).json({ error: 'Only prepaid and CashCard can be issued.' });
  }

  let digits = '';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = netsSimulator.generateCardNumber(cardType);
    if (!(await db.findAnyLinkedCardByNumber(candidate))) {
      digits = candidate;
      break;
    }
  }
  if (!digits) {
    return res.status(503).json({ error: 'Unable to generate a unique card number. Try again.' });
  }

  res.json({
    success: true,
    cardNumber: netsSimulator.formatCardNumber(digits),
  });
}));

router.post('/users/:userId/cards/link', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const linkResult = netsSimulator.buildLinkResult(req.body, user.name);
  if (!linkResult.ok) {
    return res.status(400).json({ error: linkResult.error });
  }

  const digits = netsSimulator.normalizeDigits(req.body.cardNumber);
  const existingForUser = await db.findLinkedCardByNumber(req.params.userId, digits);
  if (existingForUser) {
    return res.status(409).json({ error: 'This card is already linked to your account.' });
  }

  const linkedElsewhere = await db.findAnyLinkedCardByNumber(digits);
  if (linkedElsewhere && linkedElsewhere.user_id !== req.params.userId) {
    return res.status(409).json({ error: 'This card is already linked to another account.' });
  }

  const userCards = await db.getCards(req.params.userId);
  const isOthersDebit =
    linkResult.card.cardType === 'others' && linkResult.card.accountKind === 'debit';
  const hasDefaultDebit = userCards.some(
    (c) => c.card_type === 'others' && c.account_kind === 'debit' && c.is_default_receive
  );
  const shouldDefaultReceive =
    isOthersDebit &&
    (linkResult.card.isDefaultReceive || !hasDefaultDebit);

  const saved = await db.addCard({
    id: `card_${Date.now()}`,
    user_id: req.params.userId,
    card_type: linkResult.card.cardType,
    label: linkResult.card.label,
    card_number: digits,
    masked_number: linkResult.card.maskedNumber,
    cardholder_name: linkResult.card.cardholderName,
    expiry_date: linkResult.card.expiryDate,
    balance: linkResult.card.balance,
    credit_limit: linkResult.card.creditLimit || null,
    top_up_enabled: linkResult.card.topUpEnabled ? 1 : 0,
    bank_name: linkResult.card.bankName || null,
    account_kind: linkResult.card.accountKind || null,
    is_default_receive: shouldDefaultReceive ? 1 : 0,
  });

  if (shouldDefaultReceive) {
    await db.setDefaultReceiveCard(req.params.userId, saved.id);
  }

  res.status(201).json({
    success: true,
    source: linkResult.source,
    message:
      linkResult.source === 'nets_registry'
        ? 'Card verified with NETS registry. Balance retrieved.'
        : 'Card verified. Balance simulated from your card number.',
    card: mapCard(saved, 'wallet'),
  });
}));

router.delete('/users/:userId/cards/:cardId', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await db.deleteCard(req.params.userId, req.params.cardId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: 'Card removed from your wallet.',
    cardId: req.params.cardId,
  });
}));

router.patch('/users/:userId/cards/:cardId/default-receive', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const card = await db.getCardById(req.params.userId, req.params.cardId);
  if (!card) {
    return res.status(404).json({
      error: 'The selected card does not belong to this user.',
    });
  }

  const normalized = cardUtils.normalizeCardRow(card);
  if (normalized.card_type !== 'others' || normalized.account_kind === 'credit') {
    return res.status(400).json({ error: 'Only linked debit cards can receive incoming transfers.' });
  }

  await db.setDefaultReceiveCard(req.params.userId, req.params.cardId);
  const updated = await db.getCardById(req.params.userId, req.params.cardId);

  res.json({
    success: true,
    message: 'Default receive account updated.',
    card: mapCard(updated, 'wallet'),
  });
}));

router.patch('/users/:userId/cards/:cardId/top-up-preference', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const enabled = Boolean(req.body?.enabled);
  const result = await db.setCardTopUpEnabled(req.params.userId, req.params.cardId, enabled);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: enabled
      ? 'Low-balance top up enabled for this card.'
      : 'Low-balance top up turned off for this card.',
    card: mapCard(result.card, 'wallet'),
    lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
  });
}));

router.get('/users/:userId/notifications', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const items = await notificationService.listForUser(req.params.userId);
  res.json({
    notifications: items,
    unreadCount: await notificationService.unreadCount(req.params.userId),
  });
}));

router.patch('/users/:userId/notifications/:notificationId/read', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await db.markNotificationRead(req.params.userId, req.params.notificationId);
  if (!result.ok) {
    return res.status(404).json({ error: result.error });
  }

  res.json({
    success: true,
    notification: notificationService.formatNotification(result.notification),
    unreadCount: await notificationService.unreadCount(req.params.userId),
  });
}));

router.patch('/users/:userId/notifications/read-all', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await db.markAllNotificationsRead(req.params.userId);
  res.json({ success: true, unreadCount: 0 });
}));

// ---- Payogotchi pet (team: Calvin) ----
// The pet is client-authoritative; these just persist/return the whole
// PetState under users/{userId}/payogotchi/pet. Robust by design: no
// getUser gate, so the demo works even for accounts not yet in Firestore.
router.get('/users/:userId/payogotchi', asyncHandler(async (req, res) => {
  const pet = await db.getPayogotchiPet(req.params.userId);
  res.json({ pet });
}));

router.put('/users/:userId/payogotchi', asyncHandler(async (req, res) => {
  const pet = req.body && req.body.pet ? req.body.pet : req.body;
  if (!pet || typeof pet !== 'object' || Array.isArray(pet)) {
    return res.status(400).json({ error: 'Pet payload required.' });
  }

  const saved = await db.savePayogotchiPet(req.params.userId, pet);
  res.json({ pet: saved });
}));

// Awards real NETS Points for a level-up and/or evolution milestone — see
// payogotchi-rewards.js for the bonus scale. Bridges Payogotchi's XP loop
// into the same points balance/ledger the Rewards tab reads (points.js).
router.post('/users/:userId/payogotchi/milestone-bonus', asyncHandler(async (req, res) => {
  const { fromLevel, toLevel, evolved, newStage } = req.body || {};
  const result = await payogotchiRewards.awardPetMilestone(req.params.userId, {
    fromLevel,
    toLevel,
    evolved,
    newStage,
  });
  res.json(result);
}));

router.get('/users/:userId/receive-settings', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userCards = await db.getCards(req.params.userId);
  const cards = userCards.map((row) => mapCard(row, 'wallet'));
  const receiveTarget = cardUtils.resolveReceiveCard(userCards);

  res.json({
    defaultCardId: receiveTarget?.card?.id ?? null,
    receiveMode: receiveTarget?.mode ?? null,
    receiveLabel: receiveTarget?.label ?? null,
    receiveLabelShort: nameMask.shortReceiveLabel(receiveTarget?.label),
    eligibleCards: cards.filter(
      (c) => c.cardType === 'others' && c.accountKind === 'debit'
    ),
    fallbackPrepaid: cards.find((c) => c.cardType === 'prepaid') ?? null,
  });
}));

router.post('/users/:userId/cards/:cardId/top-up', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const card = await db.getCardById(req.params.userId, req.params.cardId);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  if (card.card_type === 'others') {
    return res.status(400).json({ error: 'Linked bank cards cannot be topped up here.' });
  }

  const amount = Number(req.body.amount);
  const method = String(req.body.method || 'bank');
  const sourceCardId = req.body.sourceCardId ? String(req.body.sourceCardId) : null;
  const allowedMethods = ['bank', 'card', 'paynow', 'linked'];

  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return res.status(400).json({ error: 'Enter a whole-dollar amount.' });
  }

  if (amount < MIN_TOP_UP_AMOUNT) {
    return res.status(400).json({ error: `Minimum top-up is $${MIN_TOP_UP_AMOUNT}.` });
  }

  if (amount > MAX_TOP_UP_AMOUNT) {
    return res.status(400).json({ error: `Maximum top-up is $${MAX_TOP_UP_AMOUNT}.` });
  }

  if ((Number(card.multi_currency?.SGD ?? card.balance) || 0) + amount > MAX_WALLET_BALANCE) {
    return res.status(400).json({
      error: `This top-up would exceed the $${MAX_WALLET_BALANCE.toLocaleString('en-SG')} wallet limit.`,
    });
  }

  if (!allowedMethods.includes(method)) {
    return res.status(400).json({ error: 'Invalid top-up method.' });
  }

  let sourceCard = null;
  let methodLabel = 'PayNow';

  if (sourceCardId || method === 'linked') {
    if (!sourceCardId) {
      return res.status(400).json({ error: 'Select a linked bank card to pay from.' });
    }

    sourceCard = await db.getCardById(req.params.userId, sourceCardId);
    if (!sourceCard || sourceCard.card_type !== 'others') {
      return res.status(400).json({ error: 'Select a valid linked bank card.' });
    }

    const normalized = cardUtils.normalizeCardRow(sourceCard);
    if (normalized.account_kind !== 'debit' && normalized.account_kind !== 'credit') {
      return res.status(400).json({ error: 'Select a valid linked debit or credit card.' });
    }

    if ((Number(sourceCard.multi_currency?.SGD ?? sourceCard.balance) || 0) - amount < SOURCE_CARD_RESERVE) {
      return res.status(400).json({
        error: `Keep at least $${SOURCE_CARD_RESERVE} available on the selected bank card.`,
      });
    }

    methodLabel = cardUtils.formatPayFromLabel(sourceCard);
  } else {
    const methodLabels = {
      bank: 'DBS Bank ****1234',
      card: 'Credit/Debit Card',
      paynow: 'PayNow',
    };
    methodLabel = methodLabels[method] || 'PayNow';
  }

  const balanceResult = await db.applyWalletTopUp(
    req.params.userId,
    card.id,
    sourceCard?.id ?? null,
    amount,
    {
      maxWalletBalance: MAX_WALLET_BALANCE,
      sourceCardReserve: SOURCE_CARD_RESERVE,
    }
  );
  if (!balanceResult.ok) {
    return res.status(400).json({ error: balanceResult.error });
  }
  const updated = balanceResult.card;
  sourceCard = balanceResult.sourceCard;

  const now = period.nowSingaporeIso();
  const roundedAmount = Math.round(amount * 100) / 100;
  const txnBaseId = `txn_${Date.now()}`;

  const saved = await db.addTransaction({
    id: `${txnBaseId}_in`,
    user_id: req.params.userId,
    card_id: card.id,
    merchant: 'NETS Top Up',
    category: 'Transfer',
    subtitle: methodLabel,
    amount: roundedAmount,
    txn_type: 'credit',
    icon: 'arrow-down-circle',
    icon_color: '#27ae60',
    occurred_at: now,
  });

  let sourceTransaction = null;
  if (sourceCard) {
    const walletLabel = cardUtils.formatPayFromLabel(card);
    sourceTransaction = await db.addTransaction({
      id: `${txnBaseId}_out`,
      user_id: req.params.userId,
      card_id: sourceCard.id,
      merchant: 'Wallet Top Up',
      category: 'Transfer',
      subtitle: `To ${walletLabel}`,
      amount: -roundedAmount,
      txn_type: 'debit',
      icon: 'arrow-up-circle',
      icon_color: '#eb5757',
      occurred_at: now,
    });
  }

  const responsePayload = {
    success: true,
    message: `Successfully topped up $${amount.toFixed(2)}. ${formatBalanceLeft(updated)}`,
    card: mapCard(updated, 'wallet'),
    transaction: formatTransaction(saved),
  };

  if (sourceCard) {
    responsePayload.sourceCard = mapCard(sourceCard, 'wallet');
    if (sourceTransaction) {
      responsePayload.sourceTransaction = formatTransaction(sourceTransaction);
    }
  }

  res.json(responsePayload);
}));

router.get('/users/:userId/transactions', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactionFilters = await resolveTransactionFilters(req.params.userId, req.query);
  const rows = await db.getTransactions(req.params.userId, {
    ...transactionFilters,
    category: req.query.category,
    type: req.query.type,
    search: req.query.search,
    month: selectedPeriod.month,
    year: selectedPeriod.year,
  });
  const allTransactions = await db.getTransactions(req.params.userId);

  res.json({
    transactions: rows.map(formatTransaction),
    summary: buildTransactionSummary(rows, selectedPeriod.month, selectedPeriod.year),
    availablePeriods: period.listAvailablePeriods(allTransactions),
    selectedPeriod: {
      month: selectedPeriod.month,
      year: selectedPeriod.year,
      label: period.monthLabel(selectedPeriod.month, selectedPeriod.year),
    },
  });
}));

router.get('/users/:userId/dashboard', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const periodType = req.query.period === 'weekly' ? 'weekly' : 'monthly';
  const transactionFilters = await resolveTransactionFilters(req.params.userId, req.query);

  const cards = await db.getCards(req.params.userId);
  const transactions = await db.getTransactions(req.params.userId, transactionFilters);
  const periodTransactions =
    periodType === 'weekly'
      ? period.filterByCurrentWeek(transactions)
      : period.filterByMonth(transactions, selectedPeriod.month, selectedPeriod.year);
  const dnaProfile = buildDnaProfile(req.params.userId, periodTransactions);

  const allTransactions = await db.getTransactions(req.params.userId);
  const insightsPack = buildInsights(
    allTransactions,
    selectedPeriod.month,
    selectedPeriod.year
  );
  const teaser = insightsPack.smartInsights[0];

  const dashboard = buildDashboard(
    user,
    cards,
    transactions,
    dnaProfile,
    selectedPeriod,
    periodType
  );

  dashboard.dnaTraits = insightsPack.traits ?? dnaProfile.traits;
  dashboard.insight = teaser
    ? { title: teaser.title, message: teaser.message }
    : dashboard.insight;
  if (teaser) {
    dashboard.teaserStyle = { icon: teaser.icon, color: teaser.color, bg: teaser.bg };
  }

  res.json(dashboard);
}));

router.get('/users/:userId/report', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactionFilters = await resolveTransactionFilters(req.params.userId, req.query);

  const transactions = await db.getTransactions(req.params.userId, transactionFilters);
  res.json(buildReport(req.params.userId, transactions, selectedPeriod.month, selectedPeriod.year));
}));

router.get('/users/:userId/insights', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactions = await db.getTransactions(req.params.userId);
  res.json(buildInsights(transactions, selectedPeriod.month, selectedPeriod.year));
}));

router.get('/users/:userId/dna-profile', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactions = await db.getTransactions(req.params.userId);
  const monthTransactions = period.filterByMonth(
    transactions,
    selectedPeriod.month,
    selectedPeriod.year
  );
  res.json(buildDnaProfile(req.params.userId, monthTransactions));
}));

async function resolveTransactionFilters(userId, query) {
  const filters = {};

  if (query.cardId) {
    filters.cardId = String(query.cardId);
    return filters;
  }

  if (query.cardNumber) {
    const digits = netsSimulator.normalizeDigits(query.cardNumber);
    const card = await db.findLinkedCardByNumber(userId, digits);
    if (card) {
      filters.cardId = card.id;
    }
    return filters;
  }

  if (query.cardType && ['prepaid', 'cashcard', 'others'].includes(String(query.cardType))) {
    filters.cardType = String(query.cardType);
  }

  return filters;
}

function groupCardsByType(cards) {
  return {
    prepaid: cards.filter((c) => c.cardType === 'prepaid'),
    cashcard: cards.filter((c) => c.cardType === 'cashcard'),
    others: cards.filter((c) => c.cardType === 'others'),
  };
}

function mapCard(row, view = 'summary') {
  const normalized = cardUtils.normalizeCardRow(row);
  const isCredit = normalized.account_kind === 'credit';
  const base = {
    id: row.id,
    cardType: row.card_type,
    label: row.label,
    maskedNumber: row.masked_number,
    balance: row.multi_currency?.SGD ?? row.balance,
    creditLimit: row.credit_limit ? clampCreditLimit(row.credit_limit) : isCredit ? clampCreditLimit(3000) : null,
    topUpEnabled: Boolean(row.top_up_enabled),
    bankName: normalized.bank_name || null,
    accountKind: normalized.account_kind || null,
    isDefaultReceive: Boolean(normalized.is_default_receive),
  };

  if (view !== 'wallet') {
    return base;
  }

  const digits = row.card_number || '';
  return {
    ...base,
    cardNumber: digits ? netsSimulator.formatCardNumber(digits) : row.masked_number,
    cardholderName: row.cardholder_name || '',
    expiryDate: row.expiry_date || '',
  };
}
// ═════════════════════════════════════════════════════════════════
// MULTI-CURRENCY WALLET ENDPOINTS
// ═════════════════════════════════════════════════════════════════

/** Get multi-currency wallet for a card */
router.get('/users/:userId/cards/:cardId/wallet', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const wallet = await db.getMultiCurrencyWallet(req.params.cardId);
  if (!wallet) {
    return res.status(404).json({ error: 'Card not found' });
  }

  res.json(wallet);
}));

/** Exchange currency */
router.post('/users/:userId/cards/:cardId/exchange', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

   // Confirm this card belongs to this user before changing balances
   const card = await db.getCardById(req.params.userId, req.params.cardId);
   if (!card) {
     return res.status(404).json({
       error: 'The selected card does not belong to this user.',
     });
   }

  const { fromCurrency, toCurrency, amount, rate } = req.body;
  if (!fromCurrency || !toCurrency || !amount || !rate) {
    return res.status(400).json({ error: 'fromCurrency, toCurrency, amount, and rate are required.' });
  }

  const result = await db.exchangeCurrency(
    req.params.cardId,
    fromCurrency,
    toCurrency,
    Number(amount),
    Number(rate)
  );

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }


  // This is added to see the transactions in homepage -- junjie
  const exchangeTransaction = await db.addTransaction({
    id: `txn_exchange_${Date.now()}`,
    user_id: req.params.userId,
    card_id: req.params.cardId,
    merchant: 'Currency Exchange',
    category: 'Currency Exchange',
    subtitle: `Rate: 1 ${fromCurrency} = ${Number(rate).toFixed(4)} ${toCurrency}`,
    display_amount: `${Number(amount).toFixed(2)} ${fromCurrency} → ${result.received.toFixed(2)} ${toCurrency}`,
    amount: 0,
    txn_type: 'exchange',
    icon: 'swap-horizontal',
    icon_color: '#9b51e0',
    occurred_at: period.nowSingaporeIso(),
  });

  res.json({
    success: true,
    message: `Exchanged ${amount} ${fromCurrency} → ${result.received.toFixed(2)} ${toCurrency}`,
    newBalances: result.newBalances,
    card: mapCard(result.card, 'wallet'),
    // The below is added to see the transactions in homepage -- junjie
    transaction: formatTransaction(exchangeTransaction),
  });
}));

/** Deduct currency for payment */
router.post('/users/:userId/cards/:cardId/deduct', asyncHandler(async (req, res) => {
  const user = await db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { currency, amount } = req.body;
  if (!currency || !amount) {
    return res.status(400).json({ error: 'currency and amount are required.' });
  }

  const result = await db.exchangeCurrency(
    req.params.cardId,
    currency,
    currency, // same currency, just deduct
    Number(amount),
    1
  );

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: `Paid ${amount} ${currency}`,
    newBalances: result.newBalances,
    card: mapCard(result.card, 'wallet'),
  });
}));

module.exports = router;
