import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listenToAuthChanges, logoutUser, isAdmin, isPendingAdmin } from '../firebase/auth';
import {
  startSessionMonitor,
  logSecurityEvent,
  SECURITY_EVENTS,
  getSecurityConfig
} from '../firebase/security';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);

  // Session management — start monitoring when user logs in
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
    
    return () => {
      if (cleanup) cleanup();
      setSessionWarning(false);
    };
  }, [currentUser]);

  // Listen to Firebase auth state
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
    sessionWarning,
    dismissSessionWarning,
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
