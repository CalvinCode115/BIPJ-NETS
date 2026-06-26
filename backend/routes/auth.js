const express = require('express');
const db = require('../db');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email || null,
    tier: user.tier,
    points: user.points,
  };
}

function formatPhoneDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : '';
}

router.post('/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const phoneDigits = formatPhoneDigits(req.body.phone);
  const pin = String(req.body.pin || '');
  const confirmPin = String(req.body.confirmPin || req.body.confirm_pin || '');
  const email = req.body.email ? String(req.body.email).trim() : null;

  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
    return res.status(400).json({ error: 'Name must contain letters only.' });
  }

  if (name.length < 2) {
    return res.status(400).json({ error: 'Enter your full name.' });
  }

  if (phoneDigits.length !== 8) {
    return res.status(400).json({ error: 'Enter a valid 8-digit mobile number.' });
  }

  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
  }

  if (pin !== confirmPin) {
    return res.status(400).json({ error: 'PIN and confirmation do not match.' });
  }

  if (email && !/^[A-Za-z0-9_@.]+@[A-Za-z0-9_.-]+\.[A-Za-z]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const formattedPhone = db.formatPhoneDisplay(phoneDigits);
  if (db.findUserByPhone(formattedPhone)) {
    return res.status(409).json({ error: 'This mobile number is already registered.' });
  }

  const user = {
    id: `user_${Date.now()}`,
    name: name,
    phone: formattedPhone,
    email,
    pin,
    tier: 'Bronze Tier',
    points: 0,
  };

  db.addUser(user);

  res.status(201).json({
    token: `demo-${user.id}-${Date.now()}`,
    user: publicUser(user),
  });
});

router.post('/login', (req, res) => {
  const { phone, pin } = req.body || {};

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN are required.' });
  }

  const user = db.findUserByPhone(phone);
  if (!user || user.pin !== String(pin)) {
    return res.status(401).json({ error: 'Invalid phone number or PIN.' });
  }

  res.json({
    token: `demo-${user.id}-${Date.now()}`,
    user: publicUser(user),
  });
});

router.post('/change-pin', (req, res) => {
  const userId = String(req.body?.userId || '').trim();
  const currentPin = String(req.body?.currentPin || '');
  const newPin = String(req.body?.newPin || '');
  const confirmPin = String(req.body?.confirmPin || '');

  if (!userId) {
    return res.status(400).json({ error: 'User is required.' });
  }

  if (!/^\d{6}$/.test(currentPin)) {
    return res.status(400).json({ error: 'Enter your current 6-digit PIN.' });
  }

  if (!/^\d{6}$/.test(newPin)) {
    return res.status(400).json({ error: 'New PIN must be exactly 6 digits.' });
  }

  if (newPin !== confirmPin) {
    return res.status(400).json({ error: 'New PIN and confirmation do not match.' });
  }

  if (newPin === currentPin) {
    return res.status(400).json({ error: 'Choose a different PIN from your current one.' });
  }

  const user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (user.pin !== currentPin) {
    return res.status(401).json({ error: 'Current PIN is incorrect.' });
  }

  db.updateUserPin(userId, newPin);

  res.json({
    success: true,
    message: 'PIN updated successfully.',
  });
});

router.get('/me', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const user = db.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({ user: publicUser(user) });
});

module.exports = router;
