import React, { useEffect, useRef, Component } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './core/AuthContext';
import { isPendingAdmin } from './firebase/auth';
import PortalLayout from './core/PortalLayout';
import Login from './components/Login';
import BranchSelection from './components/BranchSelection';
import HomePage from './modules/home/HomePage';
import SecurityFeePage from './modules/security-fee/SecurityFeePage';
import BulletinPage from './modules/bulletin/BulletinPage';
import SecurityLevelPage from './modules/security-level/SecurityLevelPage';
import SecurityPolicyPage from './modules/security-policy/SecurityPolicyPage';
import ImportantLinksPage from './modules/important-links/ImportantLinksPage';
import SettingsPage from './modules/settings/SettingsPage';
import SecurityAuditSchedulePage from './modules/security-audit/SecurityAuditSchedulePage';
import DocumentLibraryPage from './modules/document-library/DocumentLibraryPage';
import { Shield, Clock, X } from 'lucide-react';

// Session timeout warning toast
function SessionWarningToast() {
  const { sessionWarning, dismissSessionWarning, handleLogout } = useAuth();
  
  if (!sessionWarning) return null;
  
  return (
    <div style={{
      position: 'fixed', top: '1rem', right: '1rem', zIndex: 10000,
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      color: 'white', padding: '1rem 1.25rem', borderRadius: '0.75rem',
      boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
      maxWidth: '380px', width: 'calc(100vw - 2rem)',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <Clock size={22} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem' }}>Session Expiring Soon</p>
          <p style={{ margin: '0.3rem 0 0.75rem 0', fontSize: '0.8rem', opacity: 0.9, lineHeight: '1.4' }}>
            Your session will expire in 15 minutes due to inactivity. Move your mouse or press a key to stay logged in.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={dismissSessionWarning}
              style={{
                padding: '0.35rem 0.75rem', background: 'rgba(255,255,255,0.25)', color: 'white',
                border: '1px solid rgba(255,255,255,0.4)', borderRadius: '0.35rem',
                fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Stay Logged In
            </button>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.35rem 0.75rem', background: 'rgba(0,0,0,0.2)', color: 'white',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.35rem',
                fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Sign Out Now
            </button>
          </div>
        </div>
        <button
          onClick={dismissSessionWarning}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '0.15rem' }}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Error Boundary — catches render errors so the app doesn't go blank
// ============================================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0B1929 0%, #0D2137 100%)', padding: '2rem'
        }}>
          <div style={{
            background: '#132F4C', padding: '2.5rem', borderRadius: '1rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxWidth: '520px', width: '100%',
            textAlign: 'center', border: '1px solid #1E3A5F'
          }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 1.25rem',
              background: 'rgba(239,68,68,0.15)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(239,68,68,0.3)'
            }}>
              <Shield size={32} color="#EF4444" />
            </div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#E8EAED', marginBottom: '0.5rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#8B99A8', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: '1.6' }}>
              An unexpected error occurred. Please refresh the page.
            </p>
            <p style={{ color: '#5F6B7A', fontSize: '0.7rem', fontFamily: 'monospace', marginBottom: '1.5rem',
              padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.35rem',
              maxHeight: '80px', overflow: 'auto', wordBreak: 'break-all' }}>
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button onClick={() => window.location.reload()} style={{
              padding: '0.7rem 1.5rem', background: '#E94560', color: 'white',
              border: 'none', borderRadius: '0.5rem', fontSize: '0.9rem',
              fontWeight: '600', cursor: 'pointer'
            }}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading spinner
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, #0B1929 0%, #0D2137 100%)'
    }}>
      <div style={{
        width: '50px', height: '50px', border: '5px solid rgba(255,255,255,0.1)',
        borderTop: '5px solid #E94560', borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
    </div>
  );
}

// Pending admin screen
function PendingAdminScreen() {
  const { currentUser, handleLogout } = useAuth();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0B1929 0%, #0D2137 100%)', padding: '2rem'
    }}>
      <div style={{
        background: '#132F4C', padding: '2.5rem', borderRadius: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxWidth: '480px', width: '100%',
        textAlign: 'center', border: '1px solid #1E3A5F'
      }}>
        <div style={{
          width: '80px', height: '80px', margin: '0 auto 1.5rem auto',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={40} color="white" strokeWidth={2} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#E8EAED', marginBottom: '0.5rem' }}>
          Admin Approval Pending
        </h2>
        <p style={{ color: '#8B99A8', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          Your request for HQ administrator access is being reviewed.<br/>
          <strong>Email:</strong> {currentUser?.email}
        </p>
        <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.5rem', color: '#FBBF24', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Please contact your HQ administrator to approve your access.
        </div>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '0.9rem', background: '#E94560', color: 'white',
          border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer',
        }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// Route guard
function ProtectedRoutes() {
  const { currentUser, authLoading, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const prevUserRef = useRef(null);

  // 로그인 직후 항상 Home('/')으로 이동
  useEffect(() => {
    if (!authLoading && currentUser && !prevUserRef.current) {
      navigate('/', { replace: true });
    }
    prevUserRef.current = currentUser;
  }, [currentUser, authLoading, navigate]);

  if (authLoading) return <LoadingScreen />;
  if (!currentUser) return <Login />;
  if (isPendingAdmin(currentUser)) return <PendingAdminScreen />;

  // Branch user without branch selected
  const needsBranchSelection = currentUser.role !== 'hq_admin' && currentUser.role !== 'pending_admin' && !currentUser.branchName;
  if (needsBranchSelection) {
    return (
      <BranchSelection
        currentUser={currentUser}
        onBranchSelected={(selectedBranch) => {
          setCurrentUser(prev => ({ ...prev, branchName: selectedBranch }));
        }}
      />
    );
  }

  return (
    <PortalLayout>
      <SessionWarningToast />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/security-policy" element={<SecurityPolicyPage />} />
        <Route path="/security-fee" element={<SecurityFeePage />} />
        <Route path="/bulletin/*" element={<BulletinPage boardType="directive" />} />
        <Route path="/communication/*" element={<BulletinPage boardType="communication" />} />
        <Route path="/document-library/*" element={<DocumentLibraryPage />} />
        <Route path="/security-level" element={<SecurityLevelPage />} />
        <Route path="/important-links" element={<ImportantLinksPage />} />
        <Route path="/security-audit" element={<SecurityAuditSchedulePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <ProtectedRoutes />
          <SessionWarningToast />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
