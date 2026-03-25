/**
 * AirZeta Security Portal - Firebase Configuration (v3.0 - Simplified)
 * 
 * v3.0 Changes:
 * - REMOVED: Firebase App Check / reCAPTCHA Enterprise entirely
 * - REMOVED: VITE_DISABLE_APP_CHECK env var handling
 * - REMOVED: VITE_RECAPTCHA_ENTERPRISE_SITE_KEY env var handling
 * - REMOVED: Token validation, appCheckReady promise, appCheckStatus tracking
 * 
 * Security is now enforced by:
 *   1. Firestore Security Rules (server-side authorization)
 *   2. Firebase Authentication (login/password/Google)
 *   3. Client-side session timeout + rate limiting (see security.js)
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

console.log('[Config] Firebase initialized (App Check removed in v3.0 — not needed for portal operation)');

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const firebaseApp = app;

// ============================================================
// App Check Stubs (kept for API compatibility — all disabled)
// ============================================================
export const appCheckInstance = null;
export const appCheckReady = Promise.resolve('disabled');
export const appCheckStatus = 'disabled';
export const appCheckError = null;
export const googleProvider = null;

export const getAppCheckInfo = () => ({
  status: 'disabled',
  error: null,
  hasInstance: false,
  siteKeyPrefix: 'none'
});

export { firebaseConfig };
