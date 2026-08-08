const db = require('../db');
const period = require('./period');
const nameMask = require('./name-mask');

async function createTransferReceivedNotification(toUserId, { fromName, amount, transferId }) {
  const maskedName = nameMask.maskDisplayName(fromName);
  return db.addNotification({
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: toUserId,
    type: 'transfer_received',
    title: 'PayNow received',
    message: `${maskedName} sent you $${Number(amount).toFixed(2)}.`,
    read: false,
    created_at: period.nowSingaporeIso(),
    meta: {
      transferId,
      amount,
      fromName: maskedName,
    },
  });
}

async function createPointsReceivedNotification(toUserId, { fromName, amount }) {
  const maskedName = nameMask.maskDisplayName(fromName);
  const pts = Math.round(Number(amount) || 0);
  return db.addNotification({
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: toUserId,
    type: 'points_received',
    title: 'NETS Points received',
    message: `${maskedName} sent you ${pts} pts.`,
    read: false,
    created_at: period.nowSingaporeIso(),
    meta: {
      amount: pts,
      fromName: maskedName,
      unit: 'pts',
    },
  });
}

function formatNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: Boolean(row.read),
    createdAt: row.created_at,
    meta: row.meta || null,
  };
}

async function listForUser(userId) {
  return (await db.getNotifications(userId)).map(formatNotification);
}

async function unreadCount(userId) {
  return (await db.getNotifications(userId)).filter((row) => !row.read).length;
}

async function markRead(userId, notificationId) {
  return db.markNotificationRead(userId, notificationId);
}

async function markAllRead(userId) {
  return db.markAllNotificationsRead(userId);
}

module.exports = {
  createTransferReceivedNotification,
  createPointsReceivedNotification,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  formatNotification,
};
