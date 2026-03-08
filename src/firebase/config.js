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

// Note: Firebase config values are public-facing by design.
// Security is enforced via:
//   1. Firebase App Check (reCAPTCHA Enterprise) - validates app requests
//   2. Firestore Security Rules - server-side authorization
//   3. Client-side rate limiting & session management - see security.js

const app = initializeApp(firebaseConfig);

// ============================================================
// App Check initialization
// ============================================================
// 
// IMPORTANT: App Check enforcement in Firebase Console requires ALL auth requests
// to include a valid App Check token. If the token is invalid (wrong key type,
// unauthorized domain, etc.), ALL auth operations fail with:
//   "auth/firebase-app-check-token-is-invalid"
//
// The reCAPTCHA Enterprise site key MUST be a genuine reCAPTCHA Enterprise key
// (created in Google Cloud Console > reCAPTCHA Enterprise), NOT a reCAPTCHA v2/v3 key.
// Enterprise keys typically look like UUIDs, while v2/v3 keys start with "6L...".
//
// If App Check enforcement is ON in Firebase Console but the key is wrong,
// we must NOT initialize App Check at all — Firebase Auth without App Check
// will at least show a clear "App Check required" error instead of the cryptic
// "token-is-invalid" error that blocks all auth.
//
// SOLUTION: We initialize App Check, then immediately validate the token.
// If validation fails, we set a flag so the app can warn the user.

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '';
let appCheckInstance = null;
let appCheckStatus = 'disabled'; // 'disabled' | 'initializing' | 'active' | 'failed' | 'wrong_key_type'
let appCheckError = null;

// Promise that resolves when App Check validation completes
let appCheckReadyResolve;
const appCheckReady = new Promise((resolve) => {
  appCheckReadyResolve = resolve;
});

/**
 * Detect if the key looks like a reCAPTCHA v2/v3 key instead of Enterprise.
 * reCAPTCHA v2/v3 keys start with "6L" and are ~40 chars.
 * reCAPTCHA Enterprise keys are typically longer UUIDs or don't follow this pattern.
 * 
 * However, some Enterprise keys CAN start with "6L" in certain regions,
 * so we only use this as a warning, not a blocker.
 */
const isLikelyV2V3Key = (key) => {
  return key && key.startsWith('6L') && key.length <= 50;
};

if (RECAPTCHA_SITE_KEY) {
  if (isLikelyV2V3Key(RECAPTCHA_SITE_KEY)) {
    console.warn('[Config] WARNING: reCAPTCHA site key starts with "6L" - this looks like a v2/v3 key.');
    console.warn('[Config] Firebase App Check requires a reCAPTCHA ENTERPRISE key.');
    console.warn('[Config] Enterprise keys are created in: Google Cloud Console > reCAPTCHA Enterprise');
    console.warn('[Config] Current key:', RECAPTCHA_SITE_KEY.substring(0, 8) + '...');
  }
  
  appCheckStatus = 'initializing';
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    console.log('[Config] App Check initialized, validating token...');
    
    // Validate token in background - this is critical to detect wrong key type
    getToken(appCheckInstance, /* forceRefresh */ false)
      .then((tokenResult) => {
        if (tokenResult?.token) {
          appCheckStatus = 'active';
          console.log('[Config] App Check: Token valid (length:', tokenResult.token.length, ')');
        } else {
          appCheckStatus = 'failed';
          appCheckError = 'Token acquisition returned empty result';
          console.error('[Config] App Check: Empty token received');
        }
        appCheckReadyResolve(appCheckStatus);
      })
      .catch((error) => {
        appCheckStatus = 'failed';
        appCheckError = error.message;
        console.error('[Config] App Check: Token validation FAILED:', error.message);
        console.error('[Config] ===========================================');
        console.error('[Config] THIS IS THE ROOT CAUSE OF AUTH FAILURES!');
        console.error('[Config] ===========================================');
        console.error('[Config] Possible causes:');
        console.error('  1. Site key is reCAPTCHA v2/v3 format, NOT Enterprise');
        console.error('     (Enterprise keys are created in GCP > reCAPTCHA Enterprise)');
        console.error('  2. Domain not authorized for this reCAPTCHA Enterprise key');
        console.error('  3. reCAPTCHA Enterprise API not enabled in GCP');
        console.error('  4. App not registered in Firebase Console > App Check');
        console.error('[Config] Current key prefix:', RECAPTCHA_SITE_KEY.substring(0, 8) + '...');
        console.error('[Config] Current domain:', typeof window !== 'undefined' ? window.location.hostname : 'SSR');
        console.error('');
        console.error('[Config] RECOMMENDED ACTIONS:');
        console.error('[Config] Option A: Create a reCAPTCHA Enterprise key in GCP Console');
        console.error('[Config] Option B: Disable App Check enforcement in Firebase Console');
        console.error('[Config]           Firebase Console > App Check > Authentication > Unenforce');
        appCheckReadyResolve(appCheckStatus);
      });
  } catch (error) {
    appCheckStatus = 'failed';
    appCheckError = error.message;
    console.error('[Config] App Check initialization FAILED:', error.message);
    appCheckReadyResolve(appCheckStatus);
  }
} else {
  console.warn('[Config] No VITE_RECAPTCHA_ENTERPRISE_SITE_KEY set. App Check disabled.');
  console.warn('[Config] If App Check enforcement is ON in Firebase Console, auth will fail.');
  appCheckReadyResolve(appCheckStatus);
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const firebaseApp = app;
export { appCheckInstance, appCheckReady, appCheckStatus, appCheckError };
export const googleProvider = null; // placeholder for Google auth provider

// Helper to get current App Check status
export const getAppCheckInfo = () => ({
  status: appCheckStatus,
  error: appCheckError,
  hasInstance: !!appCheckInstance,
  siteKeyPrefix: RECAPTCHA_SITE_KEY ? RECAPTCHA_SITE_KEY.substring(0, 8) + '...' : 'none'
});

export { firebaseConfig };
