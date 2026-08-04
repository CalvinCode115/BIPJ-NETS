const fs = require('fs');
const path = require('path');
const { initializeApp, getApps, getApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');

let app;

function resolveServiceAccountPath() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }

  const candidates = [
    path.join(__dirname, 'service-account.json'),
    path.join(__dirname, '..', 'config', 'firebase-service-account.json'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getFirebaseApp() {
  if (app) {
    return app;
  }

  if (getApps().length) {
    app = getApp();
    return app;
  }

  const serviceAccountPath = resolveServiceAccountPath();
  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    return app;
  }

  app = initializeApp({
    credential: applicationDefault(),
  });
  return app;
}

function getFirestore() {
  return getAdminFirestore(getFirebaseApp());
}

module.exports = {
  getFirebaseApp,
  getFirestore,
  resolveServiceAccountPath,
};
