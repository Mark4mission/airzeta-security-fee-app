import React, { useState } from 'react';
import { Shield, LogIn, Loader, Mail } from 'lucide-react';
import { loginUser, loginWithGoogle } from '../firebase/auth';

const COLORS = {
  primary: '#1B3A7D',
  secondary: '#E94560',
  error: '#ef4444',
  background: '#f3f4f6'
};

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginUser(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      if (err.message === 'Google sign-in was cancelled') {
        setError('Google sign-in was cancelled. Please try again.');
      } else {
        setError(err.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '450px',
        width: '100%'
      }}>
        {/* 아이콘 로고 */}
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
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: COLORS.primary,
            marginBottom: '0.5rem'
          }}>
            Branch Security Cost Submission
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Sign in to continue
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            color: '#991b1b',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@airzeta.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#9ca3af' : COLORS.primary,
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s'
            }}
          >
            {loading ? (
              <>
                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={20} />
                Sign In with Email
              </>
            )}
          </button>
        </form>

        {/* 구분선 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '1.5rem 0',
          gap: '1rem'
        }}>
          <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: '#d1d5db' }}></div>
        </div>

        {/* Google 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: loading ? '#f3f4f6' : 'white',
            color: '#374151',
            border: '2px solid #e5e7eb',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = COLORS.primary;
              e.currentTarget.style.background = '#f9fafb';
            }
          }}
          onMouseOut={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.background = 'white';
            }
          }}
        >
          {loading ? (
            <>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Connecting...
            </>
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

        {/* 푸터 */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
          borderLeft: `4px solid ${COLORS.primary}`,
          borderRadius: '0.5rem'
        }}>
          <p style={{
            margin: 0,
            fontSize: '0.875rem',
            color: '#374151',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            🛡️ Aviation Security Team
          </p>
          <p style={{
            margin: '0.25rem 0 0 0',
            fontSize: '0.75rem',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            Powered by AIRZETA Security Operations
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
