const db = require('../db');
const period = require('./period');
const cardUtils = require('./card-utils');
const nameMask = require('./name-mask');
const notifications = require('./notifications');
const { formatBalanceLeft } = require('./balance-message');

function formatPhoneDisplay(phone) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-8);
  if (digits.length !== 8) {
    return String(phone || '');
  }
  return `+65 ${digits.slice(0, 4)} ${digits.slice(4)}`;
}

function validateAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0.01) {
    return { ok: false, error: 'Enter an amount of at least $0.01.' };
  }
  return { ok: true, amount: Math.round(value * 100) / 100 };
}

async function resolveUsers(fromUserId, { toUserId, toPhone }) {
  const fromUser = await db.getUser(fromUserId);
  if (!fromUser) {
    return { ok: false, error: 'Sender not found.' };
  }

  let toUser = null;
  if (toUserId) {
    toUser = await db.getUser(toUserId);
  } else if (toPhone) {
    toUser = await db.findUserByPhone(toPhone);
  }

  if (!toUser) {
    return { ok: false, error: 'Recipient not found.' };
  }

  if (toUser.id === fromUserId) {
    return { ok: false, error: 'You cannot transfer to yourself.' };
  }

  return { ok: true, fromUser, toUser };
}

async function executeTransfer(fromUserId, input) {
  const amountResult = validateAmount(input.amount);
  if (!amountResult.ok) {
    return amountResult;
  }

  const usersResult = await resolveUsers(fromUserId, input);
  if (!usersResult.ok) {
    return usersResult;
  }

  const { fromUser, toUser } = usersResult;
  const amount = amountResult.amount;

  const fromCards = (await db.getCards(fromUserId)).map(cardUtils.normalizeCardRow);
  const fromCard = fromCards.find((c) => c.id === input.fromCardId);
  if (!fromCard) {
    return { ok: false, error: 'Select a valid card to pay from.' };
  }

  if (!cardUtils.canPayFrom(fromCard)) {
    return { ok: false, error: 'CashCard cannot be used for person transfers.' };
  }

  if (!cardUtils.hasSufficientFunds(fromCard, amount)) {
    return {
      ok: false,
      error: cardUtils.isCreditCard(fromCard)
        ? 'Insufficient available credit on the selected card.'
        : 'Insufficient balance on the selected card.',
    };
  }

  const toCards = (await db.getCards(toUser.id)).map(cardUtils.normalizeCardRow);
  const receiveTarget = cardUtils.resolveReceiveCard(toCards);
  if (!receiveTarget?.card) {
    return {
      ok: false,
      error: `${toUser.name} has no account available to receive transfers.`,
    };
  }

  const toCard = receiveTarget.card;
  const now = period.nowSingaporeIso();
  const transferId = `xfer_${Date.now()}`;

  const senderSubtitle = `To ${formatPhoneDisplay(toUser.phone)}`;

  const receiverSubtitle = `From ${formatPhoneDisplay(fromUser.phone)}`;
  const merchantLabel = input.channel === 'qr' ? 'PayNow (QR Code)' : 'PayNow (Mobile)';

  const senderTxn = await db.addTransaction({
    id: `txn_${Date.now()}_out`,
    user_id: fromUserId,
    card_id: fromCard.id,
    merchant: merchantLabel,
    category: 'Transfer',
    subtitle: senderSubtitle,
    transfer_direction: 'to',
    counterparty_phone: toUser.phone,
    counterparty_name: toUser.name,
    amount: -amount,
    txn_type: 'debit',
    icon: 'arrow-up-circle',
    icon_color: '#eb5757',
    occurred_at: now,
    transfer_id: transferId,
  });

  const receiverTxn = await db.addTransaction({
    id: `txn_${Date.now()}_in`,
    user_id: toUser.id,
    card_id: toCard.id,
    merchant: merchantLabel,
    category: 'Transfer',
    subtitle: receiverSubtitle,
    transfer_direction: 'from',
    counterparty_phone: fromUser.phone,
    counterparty_name: fromUser.name,
    amount: amount,
    txn_type: 'credit',
    icon: 'arrow-down-circle',
    icon_color: '#27ae60',
    occurred_at: now,
    transfer_id: transferId,
  });

  await db.setCardBalance(fromCard.id, cardUtils.applyDebit(fromCard, amount));
  await db.setCardBalance(toCard.id, cardUtils.applyCredit(toCard, amount));

  const refreshedFrom = await db.getCardById(fromUserId, fromCard.id);
  const refreshedTo = await db.getCardById(toUser.id, toCard.id);

  await notifications.createTransferReceivedNotification(toUser.id, {
    fromName: fromUser.name,
    amount,
    transferId,
  });

  return {
    ok: true,
    transferId,
    amount,
    fromUser: { id: fromUser.id, name: fromUser.name, phone: fromUser.phone },
    toUser: { id: toUser.id, name: toUser.name, phone: toUser.phone },
    fromCard: refreshedFrom,
    toCard: refreshedTo,
    receiveMode: receiveTarget.mode,
    receiveLabel: receiveTarget.label,
    senderTransaction: senderTxn,
    receiverTransaction: receiverTxn,
    message: `Transferred $${amount.toFixed(2)} to ${nameMask.maskDisplayName(toUser.name)} · ${formatPhoneDisplay(toUser.phone)}. ${formatBalanceLeft(refreshedFrom)}`,
  };
}

module.exports = {
  validateAmount,
  executeTransfer,
};
