import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listenToAuthChanges, logoutUser, isAdmin, isPendingAdmin } from '../firebase/auth';
import { firebaseApp, getAppCheckInfo } from '../firebase/config';
import {
  initializeSecurityAppCheck,
  startSessionMonitor,
  logSecurityEvent,
  SECURITY_EVENTS,
  isAppCheckActive,
  getSecurityConfig
} from '../firebase/security';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({
    appCheckActive: false,
    appCheckFailed: false,
    appCheckError: null,
    sessionMonitorActive: false,
    initialized: false
  });

  // Initialize App Check status on mount
  // NOTE: App Check is already initialized in config.js at module load time.
  // This awaits token validation and sets status accordingly.
  useEffect(() => {
    const initSecurity = async () => {
      try {
        // This awaits token validation internally
        await initializeSecurityAppCheck(firebaseApp);
        const info = getAppCheckInfo();
        const isActive = info.status === 'active';
        const isFailed = info.status === 'failed';
        
        setSecurityStatus(prev => ({
          ...prev,
          appCheckActive: isActive,
          appCheckFailed: isFailed,
          appCheckError: info.error,
          initialized: true
        }));
        
        if (isActive) {
          console.log('[AuthContext] App Check: Active');
        } else if (isFailed) {
          console.error('[AuthContext] App Check: FAILED - auth operations may fail');
        } else {
          console.log('[AuthContext] App Check: Disabled');
        }
      } catch (error) {
        console.warn('[AuthContext] Security initialization warning:', error.message);
        setSecurityStatus(prev => ({ 
          ...prev, 
          initialized: true,
          appCheckFailed: true,
          appCheckError: error.message 
        }));
      }
    };
    
    initSecurity();
  }, []);

  // Session management
  useEffect(() => {
    if (!currentUser) return;

    const cleanup = startSessionMonitor({
      onWarning: (minutesLeft) => {
        setSessionWarning(true);
        console.warn(`[Security] Session will expire in ${minutesLeft} minutes`);
      },
      onTimeout: async () => {
        console.warn('[Security] Session timed out, logging out...');
        logSecurityEvent(SECURITY_EVENTS.SESSION_TIMEOUT, {
          email: currentUser?.email
        });
        try {
          await logoutUser();
          setCurrentUser(null);
        } catch (err) {
          console.error('[Security] Auto-logout failed:', err);
        }
      }
    });

    setSecurityStatus(prev => ({ ...prev, sessionMonitorActive: true }));
    
    return () => {
      if (cleanup) cleanup();
      setSecurityStatus(prev => ({ ...prev, sessionMonitorActive: false }));
      setSessionWarning(false);
    };
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = listenToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setSessionWarning(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const dismissSessionWarning = useCallback(() => {
    setSessionWarning(false);
  }, []);

  const value = {
    currentUser,
    setCurrentUser,
    authLoading,
    isAdmin: currentUser ? isAdmin(currentUser) : false,
    isPendingAdmin: currentUser ? isPendingAdmin(currentUser) : false,
    handleLogout,
    // Security-related
    sessionWarning,
    dismissSessionWarning,
    securityStatus,
    getSecurityConfig
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
