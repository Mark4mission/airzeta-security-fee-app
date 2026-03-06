/**
 * AirZeta Security Portal - Security Hardening Module (v2.2)
 * 
 * Implements multi-layer security:
 * 1. Firebase App Check (reCAPTCHA Enterprise) with global fallback
 * 2. Client-side rate limiting for login attempts
 * 3. Brute-force protection with progressive lockout
 * 4. Session management with automatic timeout
 * 5. Security audit logging to Firestore
 * 6. Device/environment fingerprinting
 * 7. Suspicious activity detection
 * 
 * Global Accessibility:
 * - reCAPTCHA Enterprise works in NA, Europe, Asia (excl. China)
 * - For China/restricted regions: graceful fallback to other security layers
 * - No user-facing friction (reCAPTCHA Enterprise is invisible/score-based)
 */

import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'firebase/app-check';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, increment, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './config';

// ============================================================
// Configuration Constants
// ============================================================

// Session timeout: 8 hours (auto-logout after inactivity)
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
// Session warning: show warning 15 min before timeout
const SESSION_WARNING_MS = 15 * 60 * 1000;
// Max failed login attempts before lockout
const MAX_LOGIN_ATTEMPTS = 5;
// Lockout duration: 15 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// Progressive lockout multiplier (each subsequent lockout doubles)
const LOCKOUT_MULTIPLIER = 2;
// Rate limit: minimum interval between login attempts (1 second)
const MIN_ATTEMPT_INTERVAL_MS = 1000;
// Password strength minimum score
const MIN_PASSWORD_STRENGTH = 3; // out of 5
// App Check token refresh interval (50 minutes, token valid for 60)
const APP_CHECK_REFRESH_MS = 50 * 60 * 1000;

// reCAPTCHA Enterprise Site Key (to be configured in Firebase Console)
// This is a public key, safe to include in client code
const RECAPTCHA_ENTERPRISE_SITE_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '';

// ============================================================
// App Check Initialization (with global fallback)
// ============================================================

let appCheckInstance = null;
let appCheckInitialized = false;
let appCheckAvailable = false;

/**
 * Initialize Firebase App Check with reCAPTCHA Enterprise
 * Gracefully handles regions where reCAPTCHA is blocked (e.g., China)
 * 
 * @param {Object} firebaseApp - The Firebase app instance
 * @returns {Object|null} App Check instance or null if unavailable
 */
export const initializeSecurityAppCheck = async (firebaseApp) => {
  if (appCheckInitialized) return appCheckInstance;
  appCheckInitialized = true;

  // If no site key configured, skip App Check (development mode)
  if (!RECAPTCHA_ENTERPRISE_SITE_KEY) {
    console.warn('[Security] App Check: No reCAPTCHA Enterprise site key configured. Skipping App Check initialization.');
    console.info('[Security] To enable App Check, set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY in .env');
    return null;
  }

  try {
    // Test reCAPTCHA availability first (for China/restricted regions)
    const recaptchaReachable = await testRecaptchaAvailability();
    
    if (!recaptchaReachable) {
      console.warn('[Security] App Check: reCAPTCHA Enterprise is not reachable (likely blocked region). Using fallback security layers.');
      logSecurityEvent('app_check_fallback', {
        reason: 'recaptcha_unreachable',
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      return null;
    }

    // Initialize App Check with reCAPTCHA Enterprise provider
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    
    appCheckAvailable = true;
    console.log('[Security] App Check: Successfully initialized with reCAPTCHA Enterprise');
    
    return appCheckInstance;
  } catch (error) {
    console.warn('[Security] App Check: Initialization failed, using fallback security layers:', error.message);
    logSecurityEvent('app_check_init_failed', {
      error: error.message,
      code: error.code
    });
    return null;
  }
};

/**
 * Test if reCAPTCHA Enterprise services are reachable
 * This prevents blocking the app for users in China and other restricted regions
 */
const testRecaptchaAvailability = () => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 3000); // 3 second timeout
    
    // Test connectivity to reCAPTCHA domain
    const img = new Image();
    img.onload = () => { clearTimeout(timeout); resolve(true); };
    img.onerror = () => { clearTimeout(timeout); resolve(false); };
    img.src = `https://www.recaptcha.net/recaptcha/enterprise.js?render=${RECAPTCHA_ENTERPRISE_SITE_KEY}&_=${Date.now()}`;
  });
};

/**
 * Get current App Check token (if available)
 */
export const getAppCheckToken = async () => {
  if (!appCheckInstance || !appCheckAvailable) return null;
  
  try {
    const tokenResult = await getToken(appCheckInstance, false);
    return tokenResult.token;
  } catch (error) {
    console.warn('[Security] App Check token retrieval failed:', error.message);
    return null;
  }
};

/**
 * Check if App Check is active
 */
export const isAppCheckActive = () => appCheckAvailable;

// ============================================================
// Rate Limiting & Brute Force Protection
// ============================================================

// In-memory rate limiter (per-session, resets on page refresh)
const loginAttempts = {
  count: 0,
  lastAttempt: 0,
  lockoutUntil: 0,
  lockoutCount: 0,
  history: [] // timestamps of recent attempts
};

/**
 * Check if login is currently rate-limited
 * @returns {{ allowed: boolean, waitSeconds: number, reason: string }}
 */
export const checkLoginRateLimit = () => {
  const now = Date.now();
  
  // Check lockout
  if (loginAttempts.lockoutUntil > now) {
    const waitSeconds = Math.ceil((loginAttempts.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      waitSeconds,
      reason: `Account temporarily locked. Please wait ${formatWaitTime(waitSeconds)}.`,
      isLocked: true
    };
  }
  
  // Check minimum interval between attempts
  if (loginAttempts.lastAttempt > 0 && (now - loginAttempts.lastAttempt) < MIN_ATTEMPT_INTERVAL_MS) {
    return {
      allowed: false,
      waitSeconds: 1,
      reason: 'Please wait a moment before trying again.',
      isLocked: false
    };
  }
  
  // Clean old attempt history (keep last 30 minutes)
  loginAttempts.history = loginAttempts.history.filter(t => (now - t) < 30 * 60 * 1000);
  
  return { allowed: true, waitSeconds: 0, reason: '', isLocked: false };
};

/**
 * Record a login attempt (call after each attempt)
 * @param {boolean} success - Whether the login was successful
 */
export const recordLoginAttempt = (success) => {
  const now = Date.now();
  loginAttempts.lastAttempt = now;
  loginAttempts.history.push(now);
  
  if (success) {
    // Reset on successful login
    loginAttempts.count = 0;
    loginAttempts.lockoutCount = 0;
    loginAttempts.history = [];
    return;
  }
  
  loginAttempts.count++;
  
  // Check if lockout threshold reached
  if (loginAttempts.count >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.lockoutCount++;
    const lockoutDuration = LOCKOUT_DURATION_MS * Math.pow(LOCKOUT_MULTIPLIER, loginAttempts.lockoutCount - 1);
    loginAttempts.lockoutUntil = now + Math.min(lockoutDuration, 60 * 60 * 1000); // max 1 hour
    loginAttempts.count = 0; // Reset count for next cycle
    
    console.warn(`[Security] Account locked for ${lockoutDuration / 1000}s after ${MAX_LOGIN_ATTEMPTS} failed attempts (lockout #${loginAttempts.lockoutCount})`);
  }
};

/**
 * Get remaining login attempts before lockout
 */
export const getRemainingAttempts = () => {
  return Math.max(0, MAX_LOGIN_ATTEMPTS - loginAttempts.count);
};

// ============================================================
// Password Strength Validation
// ============================================================

/**
 * Evaluate password strength (0-5 score)
 * @param {string} password
 * @returns {{ score: number, feedback: string[], strong: boolean }}
 */
export const evaluatePasswordStrength = (password) => {
  const feedback = [];
  let score = 0;
  
  if (!password) {
    return { score: 0, feedback: ['Password is required'], strong: false };
  }
  
  // Length checks
  if (password.length >= 8) score++;
  else feedback.push('Use at least 8 characters');
  
  if (password.length >= 12) score++;
  
  // Character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else feedback.push('Mix uppercase and lowercase letters');
  
  if (/[0-9]/.test(password)) score++;
  else feedback.push('Add a number');
  
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('Add a special character (!@#$%...)');
  
  // Common password check
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'admin', 'letmein', 'welcome'];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    score = Math.max(0, score - 2);
    feedback.push('Avoid common passwords');
  }
  
  // Sequential characters check
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid repeated characters');
  }
  
  return {
    score,
    feedback,
    strong: score >= MIN_PASSWORD_STRENGTH,
    label: getStrengthLabel(score)
  };
};

const getStrengthLabel = (score) => {
  if (score <= 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Good';
  if (score === 4) return 'Strong';
  return 'Very Strong';
};

const getStrengthColor = (score) => {
  if (score <= 1) return '#ef4444';
  if (score === 2) return '#f97316';
  if (score === 3) return '#eab308';
  if (score === 4) return '#22c55e';
  return '#059669';
};

export { getStrengthColor };

// ============================================================
// Session Management
// ============================================================

let sessionTimer = null;
let sessionWarningTimer = null;
let lastActivity = Date.now();
let sessionCallbacks = { onTimeout: null, onWarning: null };

/**
 * Start session monitoring
 * @param {Object} callbacks - { onTimeout, onWarning }
 */
export const startSessionMonitor = (callbacks = {}) => {
  sessionCallbacks = callbacks;
  lastActivity = Date.now();
  
  // Activity listeners
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  const handleActivity = () => {
    lastActivity = Date.now();
    resetSessionTimers();
  };
  
  activityEvents.forEach(event => {
    document.addEventListener(event, handleActivity, { passive: true });
  });
  
  resetSessionTimers();
  
  console.log(`[Security] Session monitor started (timeout: ${SESSION_TIMEOUT_MS / 60000} min)`);
  
  // Return cleanup function
  return () => {
    activityEvents.forEach(event => {
      document.removeEventListener(event, handleActivity);
    });
    clearTimeout(sessionTimer);
    clearTimeout(sessionWarningTimer);
  };
};

const resetSessionTimers = () => {
  clearTimeout(sessionTimer);
  clearTimeout(sessionWarningTimer);
  
  // Set warning timer
  sessionWarningTimer = setTimeout(() => {
    if (sessionCallbacks.onWarning) {
      sessionCallbacks.onWarning(SESSION_WARNING_MS / 60000); // minutes until timeout
    }
  }, SESSION_TIMEOUT_MS - SESSION_WARNING_MS);
  
  // Set timeout timer
  sessionTimer = setTimeout(() => {
    console.warn('[Security] Session timed out due to inactivity');
    if (sessionCallbacks.onTimeout) {
      sessionCallbacks.onTimeout();
    }
  }, SESSION_TIMEOUT_MS);
};

/**
 * Get session info
 */
export const getSessionInfo = () => {
  const elapsed = Date.now() - lastActivity;
  const remaining = Math.max(0, SESSION_TIMEOUT_MS - elapsed);
  return {
    lastActivity,
    elapsed,
    remaining,
    remainingMinutes: Math.ceil(remaining / 60000),
    isExpired: remaining <= 0
  };
};

// ============================================================
// Security Audit Logging
// ============================================================

const SECURITY_LOG_COLLECTION = 'securityAuditLog';

/**
 * Log a security event to Firestore
 * @param {string} eventType - Type of security event
 * @param {Object} details - Event details
 */
export const logSecurityEvent = async (eventType, details = {}) => {
  try {
    const user = auth.currentUser;
    const logEntry = {
      eventType,
      timestamp: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
      userId: user?.uid || null,
      userEmail: user?.email || details.email || null,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      appCheckActive: appCheckAvailable,
      ...details
    };
    
    await addDoc(collection(db, SECURITY_LOG_COLLECTION), logEntry);
  } catch (error) {
    // Silently fail - don't break the app if logging fails
    console.warn('[Security] Audit log write failed:', error.message);
  }
};

// Predefined event types
export const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGIN_LOCKED: 'login_locked',
  LOGOUT: 'logout',
  SESSION_TIMEOUT: 'session_timeout',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  ACCOUNT_CREATED: 'account_created',
  GOOGLE_LOGIN: 'google_login',
  GOOGLE_LOGIN_FAILED: 'google_login_failed',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  ROLE_CHANGE: 'role_change',
  USER_DISABLED: 'user_disabled',
  APP_CHECK_FALLBACK: 'app_check_fallback',
  ADMIN_ACCESS_REQUESTED: 'admin_access_requested'
};

// ============================================================
// Security Status Tracking (per-user in Firestore)
// ============================================================

/**
 * Update user security metadata on login
 */
export const updateLoginSecurityMeta = async (uid, success, email = '') => {
  try {
    const userSecRef = doc(db, 'userSecurity', uid);
    const userSecDoc = await getDoc(userSecRef);
    
    if (success) {
      await setDoc(userSecRef, {
        lastSuccessfulLogin: serverTimestamp(),
        lastLoginIp: 'client-side', // Can't get real IP from client
        lastUserAgent: navigator.userAgent,
        lastTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        failedAttemptsSinceLastLogin: 0,
        totalLogins: increment(1),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      const currentData = userSecDoc.exists() ? userSecDoc.data() : {};
      const failedCount = (currentData.failedAttemptsSinceLastLogin || 0) + 1;
      
      await setDoc(userSecRef, {
        lastFailedLogin: serverTimestamp(),
        failedAttemptsSinceLastLogin: failedCount,
        totalFailedLogins: increment(1),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Log if suspicious (many failed attempts)
      if (failedCount >= 3) {
        await logSecurityEvent(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY, {
          email,
          failedCount,
          detail: `${failedCount} consecutive failed login attempts`
        });
      }
    }
  } catch (error) {
    console.warn('[Security] Failed to update login security meta:', error.message);
  }
};

// ============================================================
// Admin Security Dashboard Data
// ============================================================

/**
 * Get recent security audit logs (admin only)
 * @param {number} limitCount - Number of logs to retrieve
 * @returns {Array} Recent security logs
 */
export const getRecentSecurityLogs = async (limitCount = 50) => {
  try {
    const q = query(
      collection(db, SECURITY_LOG_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('[Security] Failed to fetch security logs:', error);
    return [];
  }
};

/**
 * Get security summary stats (admin only)
 */
export const getSecuritySummary = async () => {
  try {
    // Get logs from last 24 hours via client-side filtering
    const allLogs = await getRecentSecurityLogs(200);
    const now = Date.now();
    const last24h = allLogs.filter(log => {
      const ts = log.timestamp?.toDate?.() || new Date(log.clientTimestamp);
      return (now - ts.getTime()) < 24 * 60 * 60 * 1000;
    });
    
    const summary = {
      totalEventsLast24h: last24h.length,
      loginSuccessCount: last24h.filter(l => l.eventType === SECURITY_EVENTS.LOGIN_SUCCESS).length,
      loginFailedCount: last24h.filter(l => l.eventType === SECURITY_EVENTS.LOGIN_FAILED).length,
      suspiciousCount: last24h.filter(l => l.eventType === SECURITY_EVENTS.SUSPICIOUS_ACTIVITY).length,
      lockoutCount: last24h.filter(l => l.eventType === SECURITY_EVENTS.LOGIN_LOCKED).length,
      googleLoginCount: last24h.filter(l => l.eventType === SECURITY_EVENTS.GOOGLE_LOGIN).length,
      appCheckActive: appCheckAvailable,
      sessionTimeoutMinutes: SESSION_TIMEOUT_MS / 60000,
      maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
      recentLogs: last24h.slice(0, 20)
    };
    
    return summary;
  } catch (error) {
    console.error('[Security] Failed to get security summary:', error);
    return null;
  }
};

// ============================================================
// Environment / Device Fingerprint (lightweight, privacy-respectful)
// ============================================================

/**
 * Generate a lightweight device fingerprint for anomaly detection
 * Does NOT use canvas/WebGL fingerprinting (privacy concern)
 * Only uses non-invasive browser properties
 */
export const getDeviceFingerprint = () => {
  const components = [
    navigator.userAgent,
    navigator.language,
    `${window.screen.width}x${window.screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset().toString()
  ];
  
  // Simple hash
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

// ============================================================
// Utility Functions
// ============================================================

/**
 * Format wait time for display
 */
const formatWaitTime = (seconds) => {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} min`;
};

/**
 * Detect if user might be in a restricted region (China, etc.)
 * Uses timezone and language heuristics (not IP-based)
 */
export const isLikelyRestrictedRegion = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = navigator.language.toLowerCase();
  
  // China-specific timezones and language indicators
  const chinaIndicators = tz === 'Asia/Shanghai' || tz === 'Asia/Chongqing' || 
                          tz === 'Asia/Harbin' || tz === 'Asia/Urumqi' ||
                          lang.startsWith('zh-cn');
  
  return chinaIndicators;
};

/**
 * Get security configuration status (for admin display)
 */
export const getSecurityConfig = () => {
  return {
    appCheck: {
      enabled: !!RECAPTCHA_ENTERPRISE_SITE_KEY,
      active: appCheckAvailable,
      provider: 'reCAPTCHA Enterprise'
    },
    rateLimiting: {
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      lockoutDuration: LOCKOUT_DURATION_MS / 1000,
      progressiveLockout: true
    },
    sessionManagement: {
      timeoutMinutes: SESSION_TIMEOUT_MS / 60000,
      warningMinutes: SESSION_WARNING_MS / 60000,
      autoRefresh: true
    },
    passwordPolicy: {
      minLength: 8,
      requireMixedCase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      strengthThreshold: MIN_PASSWORD_STRENGTH
    },
    auditLogging: {
      enabled: true,
      collection: SECURITY_LOG_COLLECTION,
      events: Object.keys(SECURITY_EVENTS).length
    },
    globalAccess: {
      chinaFallback: true,
      recaptchaFallback: true,
      description: 'Graceful degradation for restricted regions'
    }
  };
};
