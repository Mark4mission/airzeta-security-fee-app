/**
 * AirZeta Security Portal - Security Module (v3.0 - Simplified)
 * 
 * REMOVED in v3.0 (these were causing portal blocking / Firestore errors):
 * - Firebase App Check (reCAPTCHA Enterprise) - completely removed
 * - Device/environment fingerprinting - removed
 * - Suspicious activity detection - removed
 * - Pre-auth security event queue + Firestore flush - removed
 * - Security metadata writes to Firestore on every login - removed
 * 
 * RETAINED (stable, non-blocking features):
 * 1. Client-side rate limiting for login attempts (in-memory only, no Firestore)
 * 2. Brute-force protection with progressive lockout (in-memory only)
 * 3. Session management with automatic timeout
 * 4. Password strength validation
 * 5. Lightweight security event logging (console only, no Firestore dependency)
 */

// ============================================================
// Configuration Constants
// ============================================================

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_WARNING_MS = 15 * 60 * 1000;      // 15 min warning
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;     // 15 minutes
const LOCKOUT_MULTIPLIER = 2;
const MIN_ATTEMPT_INTERVAL_MS = 1000;
const MIN_PASSWORD_STRENGTH = 3;

// ============================================================
// App Check Stubs (all disabled - kept for API compatibility)
// ============================================================

/**
 * No-op: App Check has been completely removed.
 * Kept as a stub so existing code that imports this won't break.
 */
export const initializeSecurityAppCheck = async () => {
  console.log('[Security] App Check: Removed in v3.0 (not needed for portal operation)');
  return null;
};

export const getAppCheckToken = async () => null;
export const isAppCheckActive = () => false;
export const waitForAppCheckReady = async () => ({
  status: 'disabled',
  info: { status: 'disabled', error: null, hasInstance: false, siteKeyPrefix: 'none' },
  isActive: false,
  isFailed: false
});

// ============================================================
// Rate Limiting & Brute Force Protection (in-memory only)
// ============================================================

const loginAttempts = {
  count: 0,
  lastAttempt: 0,
  lockoutUntil: 0,
  lockoutCount: 0,
  history: []
};

/**
 * Check if login is currently rate-limited
 */
export const checkLoginRateLimit = () => {
  const now = Date.now();
  
  if (loginAttempts.lockoutUntil > now) {
    const waitSeconds = Math.ceil((loginAttempts.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      waitSeconds,
      reason: `Account temporarily locked. Please wait ${formatWaitTime(waitSeconds)}.`,
      isLocked: true
    };
  }
  
  if (loginAttempts.lastAttempt > 0 && (now - loginAttempts.lastAttempt) < MIN_ATTEMPT_INTERVAL_MS) {
    return { allowed: false, waitSeconds: 1, reason: 'Please wait a moment before trying again.', isLocked: false };
  }
  
  // Clean old history (30 min window)
  loginAttempts.history = loginAttempts.history.filter(t => (now - t) < 30 * 60 * 1000);
  
  return { allowed: true, waitSeconds: 0, reason: '', isLocked: false };
};

/**
 * Record a login attempt
 */
export const recordLoginAttempt = (success) => {
  const now = Date.now();
  loginAttempts.lastAttempt = now;
  loginAttempts.history.push(now);
  
  if (success) {
    loginAttempts.count = 0;
    loginAttempts.lockoutCount = 0;
    loginAttempts.history = [];
    return;
  }
  
  loginAttempts.count++;
  
  if (loginAttempts.count >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.lockoutCount++;
    const lockoutDuration = LOCKOUT_DURATION_MS * Math.pow(LOCKOUT_MULTIPLIER, loginAttempts.lockoutCount - 1);
    loginAttempts.lockoutUntil = now + Math.min(lockoutDuration, 60 * 60 * 1000);
    loginAttempts.count = 0;
    console.warn(`[Security] Account locked for ${lockoutDuration / 1000}s after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
  }
};

export const getRemainingAttempts = () => Math.max(0, MAX_LOGIN_ATTEMPTS - loginAttempts.count);

// ============================================================
// Password Strength Validation
// ============================================================

export const evaluatePasswordStrength = (password) => {
  const feedback = [];
  let score = 0;
  
  if (!password) return { score: 0, feedback: ['Password is required'], strong: false };
  
  if (password.length >= 8) score++; else feedback.push('Use at least 8 characters');
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++; else feedback.push('Mix uppercase and lowercase letters');
  if (/[0-9]/.test(password)) score++; else feedback.push('Add a number');
  if (/[^a-zA-Z0-9]/.test(password)) score++; else feedback.push('Add a special character (!@#$%...)');
  
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'admin', 'letmein', 'welcome'];
  if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
    score = Math.max(0, score - 2);
    feedback.push('Avoid common passwords');
  }
  
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid repeated characters');
  }
  
  return { score, feedback, strong: score >= MIN_PASSWORD_STRENGTH, label: getStrengthLabel(score) };
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

export const startSessionMonitor = (callbacks = {}) => {
  sessionCallbacks = callbacks;
  lastActivity = Date.now();
  
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
  
  sessionWarningTimer = setTimeout(() => {
    if (sessionCallbacks.onWarning) {
      sessionCallbacks.onWarning(SESSION_WARNING_MS / 60000);
    }
  }, SESSION_TIMEOUT_MS - SESSION_WARNING_MS);
  
  sessionTimer = setTimeout(() => {
    console.warn('[Security] Session timed out due to inactivity');
    if (sessionCallbacks.onTimeout) {
      sessionCallbacks.onTimeout();
    }
  }, SESSION_TIMEOUT_MS);
};

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
// Security Event Logging (console-only, no Firestore writes)
// ============================================================

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
  ROLE_CHANGE: 'role_change',
};

/**
 * Log a security event (console only - no Firestore dependency).
 * This ensures login/logout flows never fail due to Firestore permission errors.
 */
export const logSecurityEvent = (eventType, details = {}) => {
  console.log(`[Security Event] ${eventType}`, details.email || '');
};

/**
 * No-op: Security metadata updates removed (caused permission errors).
 */
export const updateLoginSecurityMeta = () => {};

/**
 * No-op: Device fingerprinting removed.
 */
export const getDeviceFingerprint = () => 'disabled';

// ============================================================
// Admin Security Dashboard (simplified)
// ============================================================

export const getRecentSecurityLogs = async () => [];
export const getSecuritySummary = async () => null;

export const isLikelyRestrictedRegion = () => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = navigator.language.toLowerCase();
  return tz === 'Asia/Shanghai' || tz === 'Asia/Chongqing' || 
         tz === 'Asia/Harbin' || tz === 'Asia/Urumqi' ||
         lang.startsWith('zh-cn');
};

export const getSecurityConfig = () => ({
  appCheck: { enabled: false, active: false, provider: 'none (removed in v3.0)' },
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
  auditLogging: { enabled: false, collection: 'none', events: 0 },
});

// ============================================================
// Utility
// ============================================================

const formatWaitTime = (seconds) => {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} min`;
};
