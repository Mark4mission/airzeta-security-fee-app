/**
 * AirZeta Security Portal - Firebase Configuration (v3.3 - App Check Restored)
 * 
 * v3.3 Changes:
 * - RESTORED: Firebase App Check with reCAPTCHA Enterprise
 *   The Firebase project has App Check enforcement enabled on Firestore.
 *   Without App Check tokens, ALL Firestore reads are rejected with permission-denied.
 *   This was the root cause of branch users (and all users) failing to load any data.
 * 
 * Security layers:
 *   1. Firebase App Check (reCAPTCHA Enterprise) - validates app requests
 *   2. Firestore Security Rules - server-side authorization
 *   3. Firebase Authentication (login/password/Google)
 *   4. Client-side session timeout + rate limiting (see security.js)
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'firebase/app-check';

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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const firebaseApp = app;

// ============================================================
// App Check Initialization (reCAPTCHA Enterprise)
// ============================================================
// The Firebase project enforces App Check on Firestore.
// Without this, ALL Firestore operations fail with permission-denied.

const RECAPTCHA_ENTERPRISE_SITE_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '';

let appCheckInstance = null;

if (RECAPTCHA_ENTERPRISE_SITE_KEY) {
  try {
    // Enable debug token in development for localhost testing
    if (typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      // @ts-ignore
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    console.log('[Config] Firebase App Check initialized with reCAPTCHA Enterprise');
  } catch (error) {
    console.warn('[Config] App Check initialization failed:', error.message);
    console.warn('[Config] Firestore operations may fail if App Check is enforced on the server.');
  }
} else {
  console.warn('[Config] No VITE_RECAPTCHA_ENTERPRISE_SITE_KEY found. App Check not initialized.');
  console.warn('[Config] If App Check is enforced on Firebase, all Firestore reads will fail.');
}

// ============================================================
// App Check Token Readiness
// ============================================================
// After initializeAppCheck, the SDK needs to fetch its first token
// before Firestore requests are accepted. We proactively trigger
// getToken so that other modules can await `appCheckTokenReady`
// before making Firestore calls.

let _appCheckTokenReady;
if (appCheckInstance) {
  _appCheckTokenReady = getToken(appCheckInstance, /* forceRefresh */ false)
    .then(() => {
      console.log('[Config] App Check token obtained successfully');
      return 'active';
    })
    .catch((err) => {
      console.warn('[Config] App Check token fetch failed:', err.message);
      // Still resolve (don't block the app). Firestore may still work
      // if App Check enforcement is in "monitor" mode or has exceptions.
      return 'token-failed';
    });
} else {
  _appCheckTokenReady = Promise.resolve('disabled');
}

// Export for use in other modules
export { appCheckInstance, firebaseConfig };
export const appCheckReady = _appCheckTokenReady;
export const appCheckStatus = appCheckInstance ? 'active' : 'disabled';
export const appCheckError = null;
export const googleProvider = null;

export const getAppCheckInfo = () => ({
  status: appCheckInstance ? 'active' : 'disabled',
  error: null,
  hasInstance: !!appCheckInstance,
  siteKeyPrefix: RECAPTCHA_ENTERPRISE_SITE_KEY ? RECAPTCHA_ENTERPRISE_SITE_KEY.substring(0, 8) + '...' : 'none'
});

/**
 * Convenience helper for modules that access Firestore directly.
 * Waits for App Check token to be ready before resolving.
 * Use this at the start of any useEffect that reads Firestore.
 *
 * Usage:
 *   import { waitForFirestoreReady } from '../../firebase/config';
 *   useEffect(() => {
 *     waitForFirestoreReady().then(() => getDocs(...));
 *   }, []);
 */
export const waitForFirestoreReady = () => appCheckReady;
