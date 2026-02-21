import React, { useState, useEffect } from 'react';
import { Shield, LogIn, Loader, ExternalLink, UserPlus, ArrowLeft, Mail } from 'lucide-react';
import { loginUser, loginWithGoogle, registerUser, resetPassword, initGoogleRedirectResult } from '../firebase/auth';

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

  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        await initGoogleRedirectResult();
      } catch (err) {
        console.error('[Login] Redirect result error:', err);
      }
    };
    checkRedirectResult();
  }, []);

  // 모드 전환 시 폼 초기화
  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setIsDomainError(false);
  };

  // 이메일 로그인
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsDomainError(false);
    setLoading(true);

    try {
      await loginUser(email, password);
      // onAuthStateChanged가 App.jsx에서 처리
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please check and try again.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        setError(err.message || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 이메일 회원가입
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

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      await registerUser(email, password, displayName);
      // 가입 성공 → onAuthStateChanged가 자동으로 처리
      // → App.jsx에서 branchName 없으면 BranchSelection으로 이동
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else {
        setError(err.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 재설정
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

  // Google 로그인
  const handleGoogleLogin = async () => {
    setError('');
    setSuccessMsg('');
    setIsDomainError(false);
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('domain') || msg.includes('unauthorized') || msg.includes('Cloud Console')) {
        setIsDomainError(true);
      }
      setError(msg || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  // 제목/설명
  const getTitleConfig = () => {
    switch (mode) {
      case 'signup':
        return { title: 'Create Account', subtitle: 'Sign up to get started' };
      case 'forgot':
        return { title: 'Reset Password', subtitle: 'Enter your email to receive a reset link' };
      default:
        return { title: 'Branch Security Cost Submission', subtitle: 'Sign in to continue' };
    }
  };

  const titleConfig = getTitleConfig();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${COLORS.primary} 0%, #0f2557 100%)`,
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '450px',
        width: '100%'
      }}>
        {/* 로고 헤더 */}
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

        {/* 뒤로가기 (signup, forgot 모드일 때) */}
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

        {/* 성공 메시지 */}
        {successMsg && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#d1fae5',
            border: `1px solid ${COLORS.success}`,
            borderRadius: '0.5rem',
            color: '#065f46',
            fontSize: '0.85rem',
            lineHeight: '1.5'
          }}>
            {successMsg}
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: isDomainError ? '#fef3c7' : '#fee2e2',
            border: `1px solid ${isDomainError ? '#f59e0b' : '#ef4444'}`,
            borderRadius: '0.5rem',
            color: isDomainError ? '#92400e' : '#991b1b',
            fontSize: '0.8rem',
            whiteSpace: 'pre-line',
            maxHeight: '280px',
            overflowY: 'auto',
            lineHeight: '1.5'
          }}>
            {error}
            {isDomainError && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #fbbf24' }}>
                <a href={GCP_CREDENTIALS_URL} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: '600', textDecoration: 'underline', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <ExternalLink size={14} /> Google Cloud Console (OAuth)
                </a>
                <br />
                <a href={FIREBASE_AUTH_DOMAINS_URL} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: '600', textDecoration: 'underline', fontSize: '0.8rem' }}>
                  <ExternalLink size={14} /> Firebase Console (Authorized Domains)
                </a>
              </div>
            )}
          </div>
        )}

        {/* ====== SIGN IN 모드 ====== */}
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
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem'
                  }}
                />
              </div>

              {/* Forgot Password 링크 */}
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
                disabled={loading}
                style={{
                  width: '100%', padding: '0.875rem',
                  background: loading ? '#9ca3af' : COLORS.primary,
                  color: 'white', border: 'none', borderRadius: '0.5rem',
                  fontSize: '1rem', fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'background 0.2s'
                }}
              >
                {loading ? (
                  <><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
                ) : (
                  <><LogIn size={20} /> Sign In</>
                )}
              </button>
            </form>

            {/* 구분선 */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', gap: '1rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
            </div>

            {/* Google 로그인 */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%', padding: '0.875rem',
                background: loading ? '#f3f4f6' : 'white',
                color: '#374151', border: '2px solid #e5e7eb', borderRadius: '0.5rem',
                fontSize: '1rem', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseOver={(e) => { if (!loading) { e.currentTarget.style.borderColor = COLORS.primary; e.currentTarget.style.background = '#f9fafb'; }}}
              onMouseOut={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; }}}
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

            {/* Sign Up 링크 */}
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

        {/* ====== SIGN UP 모드 ====== */}
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
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem'
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
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Password *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Re-enter your password"
                  style={{
                    width: '100%', padding: '0.75rem',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem'
                  }}
                />
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

            {/* 구분선 */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', gap: '1rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
            </div>

            {/* Google 로그인 */}
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

            {/* 이미 계정 있음 */}
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

        {/* ====== FORGOT PASSWORD 모드 ====== */}
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
                  border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem'
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

        {/* 푸터 */}
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
        </div>
      </div>
    </div>
  );
}

export default Login;
