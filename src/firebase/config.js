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
// App Check initialization (reCAPTCHA Enterprise)
// ============================================================
// 
// Firebase App Check uses reCAPTCHA Enterprise score-based site keys.
// The key is created in GCP Console > reCAPTCHA Enterprise > Website type.
// 
// When App Check enforcement is ON in Firebase Console, ALL auth requests
// must include a valid App Check token. If the token is invalid, auth fails
// with "auth/firebase-app-check-token-is-invalid".
//
// Flow: initializeAppCheck() → ReCaptchaEnterpriseProvider automatically
// loads grecaptcha.enterprise.js, calls execute(), obtains a token, and
// Firebase server creates an assessment. This resolves the GCP Console
// "키 설정 완료: 토큰 요청 (미완료)" status to "완료".
//
// NOTE: reCAPTCHA Enterprise site keys created via GCP Console for websites
// start with "6L..." (same prefix as v2/v3 keys). The key format alone
// does NOT indicate whether it is Enterprise or not.

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '';
let appCheckInstance = null;
let appCheckStatus = 'disabled'; // 'disabled' | 'initializing' | 'active' | 'failed'
let appCheckError = null;

// Promise that resolves when App Check token validation completes
let appCheckReadyResolve;
const appCheckReady = new Promise((resolve) => {
  appCheckReadyResolve = resolve;
});

if (RECAPTCHA_SITE_KEY) {
  appCheckStatus = 'initializing';
  console.log('[Config] App Check: Initializing with reCAPTCHA Enterprise key', RECAPTCHA_SITE_KEY.substring(0, 8) + '...');
  
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    
    // Validate token — this triggers grecaptcha.enterprise.execute() internally
    // and confirms the key is valid for the current domain
    getToken(appCheckInstance, /* forceRefresh */ false)
      .then((tokenResult) => {
        if (tokenResult?.token) {
          appCheckStatus = 'active';
          console.log('[Config] App Check: Active (token length:', tokenResult.token.length, ')');
          console.log('[Config] App Check: reCAPTCHA Enterprise assessment will be created by Firebase server');
          console.log('[Config] App Check: GCP Console key status should change to "완료" after first successful assessment');
        } else {
          appCheckStatus = 'failed';
          appCheckError = 'Empty token received from reCAPTCHA Enterprise';
          console.error('[Config] App Check: Token validation returned empty result');
        }
        appCheckReadyResolve(appCheckStatus);
      })
      .catch((error) => {
        appCheckStatus = 'failed';
        appCheckError = error.message;
        
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'SSR';
        console.error('[Config] App Check: Token validation FAILED');
        console.error('[Config] Error:', error.message);
        console.error('[Config] Domain:', domain);
        console.error('[Config] Key prefix:', RECAPTCHA_SITE_KEY.substring(0, 8) + '...');
        console.error('[Config] Possible causes:');
        console.error('  1. Domain "' + domain + '" is not in the key\'s allowed domains list');
        console.error('  2. reCAPTCHA Enterprise API not enabled in GCP project');
        console.error('  3. Key not registered in Firebase Console > App Check');
        console.error('  4. Key was created as reCAPTCHA v2/v3, not Enterprise (check GCP Console)');
        console.error('[Config] Fix: GCP Console > reCAPTCHA Enterprise > Edit key > Add domain');
        console.error('[Config] Or: Firebase Console > App Check > Authentication > Unenforce');
        appCheckReadyResolve(appCheckStatus);
      });
  } catch (error) {
    appCheckStatus = 'failed';
    appCheckError = error.message;
    console.error('[Config] App Check initialization error:', error.message);
    appCheckReadyResolve(appCheckStatus);
  }
} else {
  console.warn('[Config] No VITE_RECAPTCHA_ENTERPRISE_SITE_KEY configured. App Check disabled.');
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
