/**
 * Copy values from Firebase Console → Project settings → Your apps → Web app → firebaseConfig.
 * Paste into environment.ts and environment.prod.ts (same config is fine for class projects).
 */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
  /** Local Express + SQLite API (keep until team migrates data to Firestore). */
  apiUrl: 'http://localhost:3000',
};
