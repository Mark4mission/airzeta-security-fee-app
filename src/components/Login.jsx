import React, { useState, useEffect, useCallback } from 'react';
import { Shield, LogIn, Loader, ExternalLink, UserPlus, ArrowLeft, Mail, Lock, Eye, EyeOff, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { loginUser, loginWithGoogle, registerUser, resetPassword, initGoogleRedirectResult } from '../firebase/auth';
import { checkLoginRateLimit, getRemainingAttempts, evaluatePasswordStrength, getStrengthColor, waitForAppCheckReady } from '../firebase/security';
import { getAppCheckInfo } from '../firebase/config';

const COLORS = {
  primary: '#1B3A7D',
  secondary: '#E94560',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  background: '#f3f4f6'
};

const GCP_CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials?project=airzeta-security-system';
const FIREBASE_AUTH_DOMAINS_URL = 'https://console.firebase.google.com/project/airzeta-security-system/authentication/settings';

function Login() {
  // mode: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState('signin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isDomainError, setIsDomainError] = useState(false);
  const [isAppCheckError, setIsAppCheckError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [appCheckWarning, setAppCheckWarning] = useState(null);

  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        await initGoogleRedirectResult();
      } catch (err) {
        console.error('[Login] Redirect result error:', err);
      }
    };
    checkRedirectResult();
    
    // Check App Check status on mount
    const checkAppCheck = async () => {
      try {
        const result = await waitForAppCheckReady();
        if (result.isFailed) {
          const info = getAppCheckInfo();
          setAppCheckWarning({
            message: 'App Check token validation failed. Authentication may not work.',
            detail: info.error || 'Unknown error',
            siteKey: info.siteKeyPrefix
          });
          console.warn('[Login] App Check failed:', info.error);
        }
      } catch (e) {
        console.warn('[Login] App Check check error:', e);
      }
    };
    checkAppCheck();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer(prev => {
        if (prev <= 1) {
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // Password strength evaluation (for signup only)
  useEffect(() => {
    if (mode === 'signup' && password) {
      setPasswordStrength(evaluatePasswordStrength(password));
    } else {
      setPasswordStrength(null);
    }
  }, [password, mode]);

  // Mode switch with form reset
  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setIsDomainError(false);
    setIsAppCheckError(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPasswordStrength(null);
  };

  // Helper: Build App Check error message
  const buildAppCheckErrorMessage = () => {
    const info = getAppCheckInfo();
    return (
      `Firebase App Check token is invalid.\n\n` +
      `This means App Check enforcement is ON in Firebase Console, but the reCAPTCHA Enterprise token cannot be validated for this domain.\n\n` +
      `Current key prefix: ${info.siteKeyPrefix}\n` +
      `Current domain: ${window.location.hostname}\n\n` +
      `To fix this (Admin required):\n\n` +
      `[Option 1] Verify reCAPTCHA Enterprise key configuration:\n` +
      `  1. Go to Google Cloud Console > reCAPTCHA Enterprise\n` +
      `  2. Edit the site key and confirm it is a "Website" type key\n` +
      `  3. Add domain "${window.location.hostname}" to the allowed domains\n` +
      `  4. Ensure reCAPTCHA Enterprise API is enabled\n` +
      `  5. Register the key in Firebase Console > App Check\n\n` +
      `[Option 2] Temporarily disable App Check enforcement:\n` +
      `  1. Go to Firebase Console > App Check\n` +
      `  2. Click on "Authentication" under Enforce\n` +
      `  3. Toggle enforcement OFF`
    );
  };

  // Helper: Check if error is App Check related
  const isAppCheckRelatedError = (code, msg) => {
    return code === 'auth/firebase-app-check-token-is-invalid' ||
           msg?.includes('app-check-token') ||
           msg?.includes('App Check') ||
           msg?.includes('app check');
  };

  // Email sign in (with rate limiting)
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsDomainError(false);
    
    // Check rate limit before attempting
    const rateCheck = checkLoginRateLimit();
    if (!rateCheck.allowed) {
      setError(rateCheck.reason);
      if (rateCheck.isLocked) setLockoutTimer(rateCheck.waitSeconds);
      return;
    }
    
    setLoading(true);

    try {
      await loginUser(email, password);
      // onAuthStateChanged handles the rest
    } catch (err) {
      const code = err.code || '';
      const msg = err.message || '';
      if (code === 'auth/rate-limited') {
        const rateInfo = checkLoginRateLimit();
        setError(err.message);
        if (rateInfo.isLocked) setLockoutTimer(rateInfo.waitSeconds);
      } else if (isAppCheckRelatedError(code, msg)) {
        setIsAppCheckError(true);
        setError(buildAppCheckErrorMessage());
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        const remaining = getRemainingAttempts();
        const baseMsg = 'Invalid email or password.';
        setError(remaining <= 2 && remaining > 0
          ? `${baseMsg} ${remaining} attempt${remaining > 1 ? 's' : ''} remaining before temporary lockout.`
          : baseMsg
        );
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        setError(msg || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Email sign up (with password strength check)
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    // Enforce password strength
    const strength = evaluatePasswordStrength(password);
    if (!strength.strong) {
      setError(`Password is too weak (${strength.label}). ${strength.feedback.join('. ')}.`);
      setLoading(false);
      return;
    }

    try {
      await registerUser(email, password, displayName);
    } catch (err) {
      const code = err.code || '';
      const msg = err.message || '';
      if (isAppCheckRelatedError(code, msg)) {
        setIsAppCheckError(true);
        setError(buildAppCheckErrorMessage());
      } else if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 8 characters with mixed case, numbers, and special characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(msg || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Password reset
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (!email) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }

    try {
      await resetPassword(email);
      setSuccessMsg(`Password reset email sent to ${email}. Please check your inbox.`);
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(err.message || 'Failed to send reset email.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google login
  const handleGoogleLogin = async () => {
    setError('');
    setSuccessMsg('');
    setIsDomainError(false);
    
    // Check rate limit
    const rateCheck = checkLoginRateLimit();
    if (!rateCheck.allowed && rateCheck.isLocked) {
      setError(rateCheck.reason);
      setLockoutTimer(rateCheck.waitSeconds);
      return;
    }
    
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      const code = err.code || '';
      const msg = err.message || '';
      if (isAppCheckRelatedError(code, msg)) {
        setIsAppCheckError(true);
        setError(buildAppCheckErrorMessage());
      } else if (msg.includes('domain') || msg.includes('unauthorized') || msg.includes('Cloud Console')) {
        setIsDomainError(true);
        setError(msg || 'Google login failed.');
      } else {
        if (code === 'auth/rate-limited') {
          const rateInfo = checkLoginRateLimit();
          if (rateInfo.isLocked) setLockoutTimer(rateInfo.waitSeconds);
        }
        setError(msg || 'Google login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Title config
  const getTitleConfig = () => {
    switch (mode) {
      case 'signup':
        return { title: 'Create Account', subtitle: 'Sign up to get started' };
      case 'forgot':
        return { title: 'Reset Password', subtitle: 'Enter your email to receive a reset link' };
      default:
        return { title: 'Station Security Cost Submission', subtitle: 'Sign in to continue' };
    }
  };

  const titleConfig = getTitleConfig();
  const isLocked = lockoutTimer > 0;

  // Password visibility toggle style
  const eyeButtonStyle = {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center'
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`,
      padding: '2rem'
    }}>
      <div className="light-inputs" style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '450px',
        width: '100%'
      }}>
        {/* Logo header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 1rem auto',
            background: `linear-gradient(135deg, ${COLORS.secondary} 0%, #d63d54 100%)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(233, 69, 96, 0.3)'
          }}>
            <Shield size={40} color="white" strokeWidth={2} />
          </div>
          <h1 style={{
            fontSize: mode === 'signin' ? '1.5rem' : '1.75rem',
            fontWeight: 'bold',
            color: COLORS.primary,
            marginBottom: '0.5rem'
          }}>
            {titleConfig.title}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {titleConfig.subtitle}
          </p>
        </div>

        {/* Back button for signup/forgot modes */}
        {mode !== 'signin' && (
          <button
            onClick={() => switchMode('signin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0',
              background: 'none',
              border: 'none',
              color: COLORS.primary,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '1rem'
            }}
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </button>
        )}

        {/* App Check warning banner (shown when token validation fails) */}
        {appCheckWarning && !error && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: '#fff7ed',
            border: '1px solid #fb923c',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <AlertTriangle size={20} color="#ea580c" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <p style={{ margin: 0, color: '#9a3412', fontSize: '0.82rem', fontWeight: '600' }}>
                App Check Configuration Issue
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: '#c2410c', fontSize: '0.75rem', lineHeight: '1.4' }}>
                {appCheckWarning.message}
                {appCheckWarning.detail && (
                  <span style={{ display: 'block', marginTop: '0.2rem', fontSize: '0.7rem', color: '#9a3412' }}>
                    Detail: {appCheckWarning.detail}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Lockout warning banner */}
        {isLocked && (
          <div style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <Clock size={20} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, color: '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>
                Temporarily Locked
              </p>
              <p style={{ margin: '0.15rem 0 0 0', color: '#b45309', fontSize: '0.8rem' }}>
                Too many failed attempts. Please wait {lockoutTimer}s before trying again.
              </p>
            </div>
          </div>
        )}

        {/* Success message */}
        {successMsg && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#d1fae5',
            border: `1px solid ${COLORS.success}`,
            borderRadius: '0.5rem',
            color: '#065f46',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem'
          }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error message */}
        {error && !isLocked && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: isAppCheckError ? '#fef2f2' : isDomainError ? '#fef3c7' : '#fee2e2',
            border: `1px solid ${isAppCheckError ? '#dc2626' : isDomainError ? '#f59e0b' : '#ef4444'}`,
            borderRadius: '0.5rem',
            color: isAppCheckError ? '#7f1d1d' : isDomainError ? '#92400e' : '#991b1b',
            fontSize: '0.8rem',
            whiteSpace: 'pre-line',
            maxHeight: '350px',
            overflowY: 'auto',
            lineHeight: '1.5'
          }}>
            {isAppCheckError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem' }}>
                <AlertTriangle size={18} />
                App Check Token Invalid
              </div>
            )}
            {error}
            {(isDomainError || isAppCheckError) && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${isAppCheckError ? '#fca5a5' : '#fbbf24'}` }}>
                <a href="https://console.cloud.google.com/security/recaptcha?project=airzeta-security-system" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: '600', textDecoration: 'underline', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <ExternalLink size={14} /> reCAPTCHA Enterprise Console
                </a>
                <br />
                <a href="https://console.firebase.google.com/project/airzeta-security-system/appcheck" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: '600', textDecoration: 'underline', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <ExternalLink size={14} /> Firebase App Check Console
                </a>
                {isDomainError && (
                  <>
                    <br />
                    <a href={GCP_CREDENTIALS_URL} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: '600', textDecoration: 'underline', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                      <ExternalLink size={14} /> Google Cloud Console (OAuth)
                    </a>
                    <br />
                    <a href={FIREBASE_AUTH_DOMAINS_URL} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: '600', textDecoration: 'underline', fontSize: '0.8rem' }}>
                      <ExternalLink size={14} /> Firebase Console (Authorized Domains)
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====== SIGN IN ====== */}
        {mode === 'signin' && (
          <>
            <form onSubmit={handleSignIn}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isLocked}
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem',
                    background: isLocked ? '#f3f4f6' : 'white', color: '#1a1a1a',
                    opacity: isLocked ? 0.6 : 1
                  }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLocked}
                    style={{
                      width: '100%', padding: '0.75rem', paddingRight: '2.75rem',
                      border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem',
                      background: isLocked ? '#f3f4f6' : 'white', color: '#1a1a1a',
                      opacity: isLocked ? 0.6 : 1
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={eyeButtonStyle}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Forgot Password link */}
              <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  style={{
                    background: 'none', border: 'none', color: COLORS.primary,
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
                    textDecoration: 'underline', padding: 0
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || isLocked}
                style={{
                  width: '100%', padding: '0.875rem',
                  background: (loading || isLocked) ? '#9ca3af' : COLORS.primary,
                  color: 'white', border: 'none', borderRadius: '0.5rem',
                  fontSize: '1rem', fontWeight: '600',
                  cursor: (loading || isLocked) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'background 0.2s'
                }}
              >
                {loading ? (
                  <><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
                ) : isLocked ? (
                  <><Lock size={20} /> Locked ({lockoutTimer}s)</>
                ) : (
                  <><LogIn size={20} /> Sign In</>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', gap: '1rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
            </div>

            {/* Google login */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading || isLocked}
              style={{
                width: '100%', padding: '0.875rem',
                background: (loading || isLocked) ? '#f3f4f6' : 'white',
                color: '#374151', border: '2px solid #e5e7eb', borderRadius: '0.5rem',
                fontSize: '1rem', fontWeight: '600',
                cursor: (loading || isLocked) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                opacity: isLocked ? 0.6 : 1
              }}
              onMouseOver={(e) => { if (!loading && !isLocked) { e.currentTarget.style.borderColor = COLORS.primary; e.currentTarget.style.background = '#f9fafb'; }}}
              onMouseOut={(e) => { if (!loading && !isLocked) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; }}}
            >
              {loading ? (
                <><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Connecting...</>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* Sign Up link */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Don't have an account? </span>
              <button
                onClick={() => switchMode('signup')}
                style={{
                  background: 'none', border: 'none', color: COLORS.secondary,
                  cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                  textDecoration: 'underline', padding: 0
                }}
              >
                Sign Up
              </button>
            </div>
          </>
        )}

        {/* ====== SIGN UP ====== */}
        {mode === 'signup' && (
          <>
            <form onSubmit={handleSignUp}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem',
                    background: 'white', color: '#1a1a1a'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem',
                    background: 'white', color: '#1a1a1a'
                  }}
                />
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    style={{
                      width: '100%', padding: '0.75rem', paddingRight: '2.75rem',
                      border: `1px solid ${passwordStrength ? getStrengthColor(passwordStrength.score) : '#d1d5db'}`,
                      borderRadius: '0.5rem', fontSize: '1rem',
                      background: 'white', color: '#1a1a1a',
                      transition: 'border-color 0.2s'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={eyeButtonStyle}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Password strength meter */}
              {passwordStrength && password && (
                <div style={{ marginBottom: '1rem' }}>
                  {/* Strength bar */}
                  <div style={{
                    height: '4px',
                    background: '#e5e7eb',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    marginBottom: '0.4rem'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(passwordStrength.score / 5) * 100}%`,
                      background: getStrengthColor(passwordStrength.score),
                      borderRadius: '2px',
                      transition: 'width 0.3s, background 0.3s'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '600',
                      color: getStrengthColor(passwordStrength.score)
                    }}>
                      {passwordStrength.label}
                    </span>
                    {passwordStrength.feedback.length > 0 && (
                      <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                        {passwordStrength.feedback[0]}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Confirm Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    style={{
                      width: '100%', padding: '0.75rem', paddingRight: '2.75rem',
                      border: `1px solid ${confirmPassword && confirmPassword === password ? COLORS.success : confirmPassword ? COLORS.error : '#d1d5db'}`,
                      borderRadius: '0.5rem', fontSize: '1rem',
                      background: 'white', color: '#1a1a1a',
                      transition: 'border-color 0.2s'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={eyeButtonStyle}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p style={{ fontSize: '0.72rem', color: COLORS.error, marginTop: '0.3rem' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '0.875rem',
                  background: loading ? '#9ca3af' : COLORS.success,
                  color: 'white', border: 'none', borderRadius: '0.5rem',
                  fontSize: '1rem', fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'background 0.2s'
                }}
              >
                {loading ? (
                  <><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Creating account...</>
                ) : (
                  <><UserPlus size={20} /> Create Account</>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', gap: '1rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
            </div>

            {/* Google login */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%', padding: '0.875rem',
                background: 'white', color: '#374151',
                border: '2px solid #e5e7eb', borderRadius: '0.5rem',
                fontSize: '1rem', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { if (!loading) { e.currentTarget.style.borderColor = COLORS.primary; }}}
              onMouseOut={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#e5e7eb'; }}}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign up with Google
            </button>

            {/* Already have account */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Already have an account? </span>
              <button
                onClick={() => switchMode('signin')}
                style={{
                  background: 'none', border: 'none', color: COLORS.primary,
                  cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                  textDecoration: 'underline', padding: 0
                }}
              >
                Sign In
              </button>
            </div>
          </>
        )}

        {/* ====== FORGOT PASSWORD ====== */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '0.75rem',
                  border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem',
                  background: 'white', color: '#1a1a1a'
                }}
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                We'll send a password reset link to this email address.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '0.875rem',
                background: loading ? '#9ca3af' : COLORS.warning,
                color: 'white', border: 'none', borderRadius: '0.5rem',
                fontSize: '1rem', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'background 0.2s'
              }}
            >
              {loading ? (
                <><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
              ) : (
                <><Mail size={20} /> Send Reset Link</>
              )}
            </button>
          </form>
        )}

        {/* Footer with security badge */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
          borderLeft: `4px solid ${COLORS.primary}`,
          borderRadius: '0.5rem'
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', fontWeight: '500', textAlign: 'center' }}>
            Aviation Security Team
          </p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
            Powered by AIRZETA Security Operations
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Lock size={11} color="#9ca3af" />
            <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
              Protected by Firebase Authentication & App Check
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
