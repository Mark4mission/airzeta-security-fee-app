import React, { useEffect, useRef } from 'react';
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
import SettingsPage from './modules/settings/SettingsPage';
import { Shield } from 'lucide-react';

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/security-fee" element={<SecurityFeePage />} />
        <Route path="/bulletin/*" element={<BulletinPage />} />
        <Route path="/security-level" element={<SecurityLevelPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalLayout>
  );
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ProtectedRoutes />
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
