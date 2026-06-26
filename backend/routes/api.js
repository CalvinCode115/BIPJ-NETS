const express = require('express');
const db = require('../db');
const authRouter = require('./auth');
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
const { LOW_BALANCE_THRESHOLD } = require('../services/wallet-config');
const { clampCreditLimit } = require('../services/credit-config');
const { formatBalanceLeft } = require('../services/balance-message');

const router = express.Router();

router.use('/auth', authRouter);

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'nets-backend', mode: 'simulation' });
});

/** Demo registry — cards known to the simulated NETS system */
router.get('/nets-simulator/registry', (_req, res) => {
  res.json({
    description: 'Known cards in the NETS simulation registry. Linking returns these balances.',
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

router.post('/users/:userId/transactions/receipt', (req, res) => {
  const user = db.getUser(req.params.userId);
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
    card = db.findLinkedCardByNumber(req.params.userId, digits);
    if (!card) {
      return res.status(400).json({
        error: 'This receipt was paid with a card that is not linked to your account.',
      });
    }
  } else {
    card = db.resolveCardForPayment(req.params.userId, receipt.paymentMethod);
    if (!card) {
      return res.status(400).json({ error: 'No linked card found for this payment method.' });
    }
  }

  const saved = db.addTransaction(createTransactionFromReceipt(req.params.userId, receipt, card));

  const refreshedCard = db.setCardBalance(
    card.id,
    cardUtils.applyDebit(card, Math.abs(receipt.amount))
  );

  res.status(201).json({
    success: true,
    message: `Receipt added to your transactions. ${formatBalanceLeft(refreshedCard)}`,
    transaction: formatTransaction(saved),
    card: mapCard(refreshedCard, 'wallet'),
  });
});

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

router.post('/payments/qr/parse', (req, res) => {
  const result = qrPayment.parseQrPayload(req.body.payload);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  if (result.kind === 'receive') {
    const recipient = db.getUser(result.receive.userId);
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient in this QR is not registered.' });
    }

    const receiveTarget = cardUtils.resolveReceiveCard(db.getCards(recipient.id));
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
});

router.get('/users/lookup', (req, res) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const user = db.findUserByPhone(phone);
  if (!user) {
    return res.status(404).json({ error: 'No NETS user found for this mobile number.' });
  }

  const receiveTarget = cardUtils.resolveReceiveCard(db.getCards(user.id));
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
});

router.get('/users/:userId/qr/receive', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const receiveTarget = cardUtils.resolveReceiveCard(db.getCards(user.id));

  res.json({
    payload: qrPayment.buildReceivePayload(user),
    name: user.name,
    phone: user.phone,
    receiveLabel: receiveTarget?.label ?? null,
    receiveMode: receiveTarget?.mode ?? null,
  });
});

router.post('/users/:userId/payments/qr', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const parsed = qrPayment.parseQrPayload(req.body.payload);
  if (!parsed.ok || parsed.kind !== 'pay' || !parsed.payment) {
    return res.status(400).json({ error: parsed.error || 'Invalid payment QR.' });
  }

  let card = null;
  if (req.body.cardId) {
    card = db.getCards(req.params.userId).find((row) => row.id === req.body.cardId) || null;
  } else if (req.body.cardNumber) {
    const digits = netsSimulator.normalizeDigits(req.body.cardNumber);
    card = db.findLinkedCardByNumber(req.params.userId, digits);
  } else {
    card = db.resolveCardForPayment(req.params.userId, 'NETS Prepaid');
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

  if (!cardUtils.hasSufficientFunds(card, parsed.payment.amount)) {
    return res.status(400).json({ error: 'Insufficient balance on the selected card.' });
  }

  const saved = db.addTransaction(
    qrPayment.createTransactionFromQr(req.params.userId, parsed.payment, card)
  );

  const refreshedCard = db.setCardBalance(card.id, cardUtils.applyDebit(card, parsed.payment.amount));

  res.status(201).json({
    success: true,
    message: `Paid $${parsed.payment.amount.toFixed(2)} to ${parsed.payment.merchant}. ${formatBalanceLeft(refreshedCard)}`,
    payment: parsed.payment,
    transaction: formatTransaction(saved),
    card: {
      id: refreshedCard.id,
      balance: refreshedCard.balance,
    },
  });
});

router.post('/users/:userId/transfers', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = p2pTransfer.executeTransfer(req.params.userId, {
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
});

router.post('/users/:userId/payments/qr/receive', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const parsed = qrPayment.parseQrPayload(req.body.payload);
  if (!parsed.ok || parsed.kind !== 'receive' || !parsed.receive?.userId) {
    return res.status(400).json({ error: parsed.error || 'Invalid receive QR.' });
  }

  const result = p2pTransfer.executeTransfer(req.params.userId, {
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
});

router.get('/users/:userId/payable-cards', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cards = db
    .getCards(req.params.userId)
    .filter(cardUtils.canPayFrom)
    .map((row) => mapCard(row, 'wallet'));

  res.json({ cards });
});

router.get('/users/:userId', (req, res) => {
  const user = db.getUser(req.params.userId);
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
});

router.get('/users/:userId/cards', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cardType = req.query.type;
  if (cardType && !['prepaid', 'cashcard', 'others'].includes(cardType)) {
    return res.status(400).json({ error: 'Invalid card type. Use prepaid, cashcard, or others.' });
  }

  const view = req.query.view || 'summary';
  const cards = db.getCards(req.params.userId, cardType).map((row) => mapCard(row, view));
  res.json({ cards });
});

router.get('/users/:userId/cards/wallet', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cards = db.getCards(req.params.userId).map((row) => mapCard(row, 'wallet'));
  res.json({ cardsByType: groupCardsByType(cards) });
});

router.post('/users/:userId/cards/link', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const linkResult = netsSimulator.buildLinkResult(req.body, user.name);
  if (!linkResult.ok) {
    return res.status(400).json({ error: linkResult.error });
  }

  const digits = netsSimulator.normalizeDigits(req.body.cardNumber);
  const existingForUser = db.findLinkedCardByNumber(req.params.userId, digits);
  if (existingForUser) {
    return res.status(409).json({ error: 'This card is already linked to your account.' });
  }

  const linkedElsewhere = db.findAnyLinkedCardByNumber(digits);
  if (linkedElsewhere && linkedElsewhere.user_id !== req.params.userId) {
    return res.status(409).json({ error: 'This card is already linked to another account.' });
  }

  const userCards = db.getCards(req.params.userId);
  const isOthersDebit =
    linkResult.card.cardType === 'others' && linkResult.card.accountKind === 'debit';
  const hasDefaultDebit = userCards.some(
    (c) => c.card_type === 'others' && c.account_kind === 'debit' && c.is_default_receive
  );
  const shouldDefaultReceive =
    isOthersDebit &&
    (linkResult.card.isDefaultReceive || !hasDefaultDebit);

  const saved = db.addCard({
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
    db.setDefaultReceiveCard(req.params.userId, saved.id);
  }

  res.status(201).json({
    success: true,
    source: linkResult.source,
    message:
      linkResult.source === 'nets_registry'
        ? 'Card verified with NETS registry. Balance retrieved.'
        : 'Card verified with NETS simulation. Balance retrieved.',
    card: mapCard(saved, 'wallet'),
  });
});

router.delete('/users/:userId/cards/:cardId', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = db.deleteCard(req.params.userId, req.params.cardId);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: 'Card removed from your wallet.',
    cardId: req.params.cardId,
  });
});

router.patch('/users/:userId/cards/:cardId/default-receive', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const card = db.getCardById(req.params.userId, req.params.cardId);
  if (!card) {
    return res.status(404).json({ error: 'Card not found.' });
  }

  const normalized = cardUtils.normalizeCardRow(card);
  if (normalized.card_type !== 'others' || normalized.account_kind === 'credit') {
    return res.status(400).json({ error: 'Only linked debit cards can receive incoming transfers.' });
  }

  db.setDefaultReceiveCard(req.params.userId, req.params.cardId);
  const updated = db.getCardById(req.params.userId, req.params.cardId);

  res.json({
    success: true,
    message: 'Default receive account updated.',
    card: mapCard(updated, 'wallet'),
  });
});

router.patch('/users/:userId/cards/:cardId/top-up-preference', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const enabled = Boolean(req.body?.enabled);
  const result = db.setCardTopUpEnabled(req.params.userId, req.params.cardId, enabled);
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
});

router.get('/users/:userId/notifications', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const items = notificationService.listForUser(req.params.userId);
  res.json({
    notifications: items,
    unreadCount: notificationService.unreadCount(req.params.userId),
  });
});

router.patch('/users/:userId/notifications/:notificationId/read', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = db.markNotificationRead(req.params.userId, req.params.notificationId);
  if (!result.ok) {
    return res.status(404).json({ error: result.error });
  }

  res.json({
    success: true,
    notification: notificationService.formatNotification(result.notification),
    unreadCount: notificationService.unreadCount(req.params.userId),
  });
});

router.patch('/users/:userId/notifications/read-all', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.markAllNotificationsRead(req.params.userId);
  res.json({ success: true, unreadCount: 0 });
});

router.get('/users/:userId/receive-settings', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const cards = db.getCards(req.params.userId).map((row) => mapCard(row, 'wallet'));
  const receiveTarget = cardUtils.resolveReceiveCard(db.getCards(req.params.userId));

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
});

router.post('/users/:userId/cards/:cardId/top-up', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const card = db.getCardById(req.params.userId, req.params.cardId);
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

  if (!Number.isFinite(amount) || amount < 0.01) {
    return res.status(400).json({ error: 'Enter an amount of at least $0.01.' });
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

    sourceCard = db.getCardById(req.params.userId, sourceCardId);
    if (!sourceCard || sourceCard.card_type !== 'others') {
      return res.status(400).json({ error: 'Select a valid linked bank card.' });
    }

    const normalized = cardUtils.normalizeCardRow(sourceCard);
    if (normalized.account_kind !== 'debit') {
      return res.status(400).json({ error: 'Top up can only be funded from a linked debit card.' });
    }

    if (!cardUtils.hasSufficientFunds(sourceCard, amount)) {
      return res.status(400).json({ error: 'Insufficient balance on the selected bank card.' });
    }

    methodLabel = cardUtils.formatPayFromLabel(sourceCard);
    db.setCardBalance(sourceCard.id, cardUtils.applyDebit(sourceCard, amount));
  } else {
    const methodLabels = {
      bank: 'DBS Bank ****1234',
      card: 'Credit/Debit Card',
      paynow: 'PayNow',
    };
    methodLabel = methodLabels[method] || 'PayNow';
  }

  const updated = db.updateCardBalance(card.id, amount);
  if (!updated) {
    return res.status(500).json({ error: 'Unable to update card balance.' });
  }

  const saved = db.addTransaction({
    id: `txn_${Date.now()}`,
    user_id: req.params.userId,
    card_id: card.id,
    merchant: 'NETS Top Up',
    category: 'Transfer',
    subtitle: methodLabel,
    amount: Math.round(amount * 100) / 100,
    txn_type: 'credit',
    icon: 'arrow-down-circle',
    icon_color: '#27ae60',
    occurred_at: period.nowSingaporeIso(),
  });

  const responsePayload = {
    success: true,
    message: `Successfully topped up $${amount.toFixed(2)}. ${formatBalanceLeft(updated)}`,
    card: mapCard(updated, 'wallet'),
    transaction: formatTransaction(saved),
  };

  if (sourceCard) {
    responsePayload.sourceCard = mapCard(
      db.getCardById(req.params.userId, sourceCard.id),
      'wallet'
    );
  }

  res.json(responsePayload);
});

router.get('/users/:userId/transactions', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactionFilters = resolveTransactionFilters(req.params.userId, req.query);
  const rows = db.getTransactions(req.params.userId, {
    ...transactionFilters,
    category: req.query.category,
    type: req.query.type,
    search: req.query.search,
    month: selectedPeriod.month,
    year: selectedPeriod.year,
  });
  const allTransactions = db.getTransactions(req.params.userId);

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
});

router.get('/users/:userId/dashboard', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const periodType = req.query.period === 'weekly' ? 'weekly' : 'monthly';
  const transactionFilters = resolveTransactionFilters(req.params.userId, req.query);

  const cards = db.getCards(req.params.userId);
  const transactions = db.getTransactions(req.params.userId, transactionFilters);
  const periodTransactions =
    periodType === 'weekly'
      ? period.filterByCurrentWeek(transactions)
      : period.filterByMonth(transactions, selectedPeriod.month, selectedPeriod.year);
  const dnaProfile = buildDnaProfile(req.params.userId, periodTransactions);

  const allTransactions = db.getTransactions(req.params.userId);
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
});

router.get('/users/:userId/report', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactionFilters = resolveTransactionFilters(req.params.userId, req.query);

  const transactions = db.getTransactions(req.params.userId, transactionFilters);
  res.json(buildReport(req.params.userId, transactions, selectedPeriod.month, selectedPeriod.year));
});

router.get('/users/:userId/insights', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactions = db.getTransactions(req.params.userId);
  res.json(buildInsights(transactions, selectedPeriod.month, selectedPeriod.year));
});

router.get('/users/:userId/dna-profile', (req, res) => {
  const user = db.getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const selectedPeriod = period.parsePeriod(req.query.month, req.query.year);
  const transactions = db.getTransactions(req.params.userId);
  const monthTransactions = period.filterByMonth(
    transactions,
    selectedPeriod.month,
    selectedPeriod.year
  );
  res.json(buildDnaProfile(req.params.userId, monthTransactions));
});

function resolveTransactionFilters(userId, query) {
  const filters = {};

  if (query.cardId) {
    filters.cardId = String(query.cardId);
    return filters;
  }

  if (query.cardNumber) {
    const digits = netsSimulator.normalizeDigits(query.cardNumber);
    const card = db.findLinkedCardByNumber(userId, digits);
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
    balance: row.balance,
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

module.exports = router;
